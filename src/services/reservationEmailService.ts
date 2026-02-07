import { prisma } from '@/lib/prisma'
import type { ParsedEmailReservation } from '@/lib/IMAP'

export type ReservationStatus = 'pending' | 'confirmed' | 'rejected'

export interface EmailReservationWithStats {
  id: number
  first_name: string
  last_name: string
  phone: string
  email: string
  reservation_date: string
  reservation_time: string
  guests: number
  special_requests: string | null
  received_at: string
  status: ReservationStatus
  confirmed_reservations: number
  total_guests_for_date: number
}

export interface ImportResult {
  success: boolean
  processedCount: number
  errors: string[]
  insertedEmails: ParsedEmailReservation[]
}

function formatTime(dt: Date): string {
  return dt.toISOString().slice(11, 16)
}

function formatDate(dt: Date): string {
  return dt.toISOString().split('T')[0]
}

// --- Import functions (replacing DatabaseImporter) ---

export async function importReservations(emails: ParsedEmailReservation[]): Promise<ImportResult> {
  const result: ImportResult = { success: true, processedCount: 0, errors: [], insertedEmails: [] }
  if (emails.length === 0) return result

  try {
    const existingUids = await getExistingUids(emails.map(e => e.uid))
    const newEmails = emails.filter(email => !existingUids.includes(email.uid))

    console.log(`📊 Total emails: ${emails.length}, New emails: ${newEmails.length}...`)

    for (const email of newEmails) {
      try {
        await insertReservation(email)
        result.insertedEmails.push(email)
        result.processedCount++
        console.log(`✅ Imported UID ${email.uid}: ${email.firstName} ${email.lastName}`)
      } catch (error) {
        const errorMessage = `Failed to import UID ${email.uid}: ${error instanceof Error ? error.message : String(error)}`
        result.errors.push(errorMessage)
        result.success = false
        console.error(`❌ ${errorMessage}`)
      }
    }
    return result
  } catch (error) {
    result.success = false
    result.errors.push(`Database import failed: ${error instanceof Error ? error.message : String(error)}`)
    console.error('❌ Database import failed:', error)
    return result
  }
}

export async function getExistingUids(uids: number[]): Promise<number[]> {
  if (uids.length === 0) return []
  const records = await prisma.reservationEmail.findMany({
    where: { id: { in: uids.map(BigInt) } },
    select: { id: true },
  })
  return records.map(r => Number(r.id))
}

export async function insertReservation(email: ParsedEmailReservation): Promise<void> {
  await prisma.reservationEmail.create({
    data: {
      id: BigInt(email.uid),
      firstName: email.firstName,
      lastName: email.lastName,
      phone: email.phone,
      email: email.email,
      reservationDate: new Date(email.reservationDate),
      reservationTime: new Date(`1970-01-01T${email.reservationTime}:00Z`),
      guests: email.guests,
      specialRequests: email.specialRequests || null,
      receivedAt: new Date(email.receivedAt),
      status: 'pending',
    },
  })
}

export async function getMaxUid(): Promise<number> {
  const result = await prisma.reservationEmail.aggregate({ _max: { id: true } })
  return Number(result._max.id ?? 0)
}

export async function updateStatus(uid: number, status: ReservationStatus): Promise<boolean> {
  try {
    await prisma.reservationEmail.update({
      where: { id: BigInt(uid) },
      data: { status },
    })
    console.log(`✅ Updated UID ${uid} status to ${status}`)
    return true
  } catch (error) {
    console.error(`❌ Error updating status for UID ${uid}:`, error)
    return false
  }
}

export async function checkExists(uid: number): Promise<boolean> {
  const count = await prisma.reservationEmail.count({ where: { id: BigInt(uid) } })
  return count > 0
}

export async function getPendingUids(): Promise<number[]> {
  const records = await prisma.reservationEmail.findMany({
    where: { status: 'pending' },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  return records.map(r => Number(r.id))
}

// --- Query functions (replacing raw SQL in API routes) ---

export async function getReservationsByDate(date: string) {
  const reservations = await prisma.reservationEmail.findMany({
    where: { reservationDate: new Date(date) },
    orderBy: { reservationTime: 'asc' },
  })
  return reservations.map(r => ({
    id: Number(r.id),
    first_name: r.firstName,
    last_name: r.lastName,
    phone: r.phone,
    email: r.email,
    reservation_date: formatDate(r.reservationDate),
    reservation_time: formatTime(r.reservationTime),
    guests: r.guests,
    special_requests: r.specialRequests,
    status: r.status,
  }))
}

export async function getReservationById(uid: number) {
  const r = await prisma.reservationEmail.findUnique({
    where: { id: BigInt(uid) },
  })
  if (!r) return null
  return {
    id: Number(r.id),
    first_name: r.firstName,
    last_name: r.lastName,
    phone: r.phone,
    email: r.email,
    reservation_date: formatDate(r.reservationDate),
    reservation_time: formatTime(r.reservationTime),
    guests: r.guests,
    special_requests: r.specialRequests,
    received_at: r.receivedAt?.toISOString() ?? '',
    status: r.status as ReservationStatus,
  }
}

export async function getAllWithDateStats(): Promise<EmailReservationWithStats[]> {
  const [reservations, dateStats] = await Promise.all([
    prisma.reservationEmail.findMany({
      orderBy: [{ id: 'desc' }],
    }),
    prisma.reservationEmail.groupBy({
      by: ['reservationDate'],
      where: { status: 'confirmed' },
      _count: { id: true },
      _sum: { guests: true },
    }),
  ])

  const statsMap = new Map<string, { count: number; totalGuests: number }>()
  for (const stat of dateStats) {
    const dateKey = formatDate(stat.reservationDate)
    statsMap.set(dateKey, {
      count: stat._count.id,
      totalGuests: stat._sum.guests ?? 0,
    })
  }

  // Sort: pending first (by id DESC), then non-pending (by id DESC)
  const sorted = reservations.sort((a, b) => {
    const aIsPending = a.status === 'pending' ? 0 : 1
    const bIsPending = b.status === 'pending' ? 0 : 1
    if (aIsPending !== bIsPending) return aIsPending - bIsPending
    return Number(b.id) - Number(a.id)
  })

  return sorted.map(r => {
    const dateKey = formatDate(r.reservationDate)
    const stats = statsMap.get(dateKey) ?? { count: 0, totalGuests: 0 }
    return {
      id: Number(r.id),
      first_name: r.firstName,
      last_name: r.lastName,
      phone: r.phone,
      email: r.email,
      reservation_date: dateKey,
      reservation_time: formatTime(r.reservationTime),
      guests: r.guests,
      special_requests: r.specialRequests,
      received_at: r.receivedAt?.toISOString() ?? '',
      status: r.status as ReservationStatus,
      confirmed_reservations: stats.count,
      total_guests_for_date: stats.totalGuests,
    }
  })
}

export async function changeReservationStatus(
  uid: number,
  fromStatus: ReservationStatus,
  toStatus: ReservationStatus
): Promise<{ found: boolean }> {
  const reservation = await prisma.reservationEmail.findFirst({
    where: { id: BigInt(uid), status: fromStatus },
  })
  if (!reservation) return { found: false }

  await prisma.reservationEmail.update({
    where: { id: BigInt(uid) },
    data: { status: toStatus },
  })
  return { found: true }
}
