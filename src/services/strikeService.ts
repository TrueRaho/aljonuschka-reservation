import { prisma } from '@/lib/prisma'

export async function getStrikesByEmail(email: string): Promise<number> {
  const record = await prisma.customerStrike.findUnique({
    where: { email },
    select: { strikes: true },
  })
  return record?.strikes ?? 0
}

export async function getStrikesByEmails(emails: string[]): Promise<Map<string, number>> {
  if (emails.length === 0) return new Map()
  const records = await prisma.customerStrike.findMany({
    where: { email: { in: emails } },
    select: { email: true, strikes: true },
  })
  const map = new Map<string, number>()
  for (const r of records) {
    map.set(r.email, r.strikes)
  }
  return map
}

export async function incrementStrike(email: string): Promise<number> {
  const record = await prisma.customerStrike.upsert({
    where: { email },
    update: { strikes: { increment: 1 }, updatedAt: new Date() },
    create: { email, strikes: 1 },
  })
  return record.strikes
}

export async function decrementStrike(email: string): Promise<number> {
  const record = await prisma.customerStrike.findUnique({ where: { email } })
  if (!record || record.strikes <= 0) return 0
  const updated = await prisma.customerStrike.update({
    where: { email },
    data: { strikes: { decrement: 1 }, updatedAt: new Date() },
  })
  return updated.strikes
}
