import { prisma } from '@/lib/prisma'

export interface AnalyticsKPI {
  totalGuests: number
  totalReservations: number
  avgGuestsPerReservation: number
}

export interface DailyTraffic {
  date: string
  guests: number
}

export interface PeakHour {
  hour: number
  guests: number
}

export interface PartySizeDistribution {
  category: string
  count: number
}

export interface AnalyticsData {
  kpi: AnalyticsKPI
  dailyTraffic: DailyTraffic[]
  peakHours: PeakHour[]
  partySizeDistribution: PartySizeDistribution[]
}

function formatDate(dt: Date): string {
  return dt.toISOString().split('T')[0]
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const ninetyDaysAgo = new Date(now)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [last30Days, last90Days] = await Promise.all([
    prisma.reservationEmail.findMany({
      where: {
        status: 'confirmed',
        reservationDate: { gte: thirtyDaysAgo },
      },
      select: {
        guests: true,
        reservationDate: true,
        reservationTime: true,
      },
    }),
    prisma.reservationEmail.findMany({
      where: {
        status: 'confirmed',
        reservationDate: { gte: ninetyDaysAgo },
      },
      select: {
        guests: true,
        reservationTime: true,
      },
    }),
  ])

  // --- KPI (last 30 days) ---
  const totalGuests = last30Days.reduce((sum, r) => sum + r.guests, 0)
  const totalReservations = last30Days.length
  const avgGuestsPerReservation = totalReservations > 0
    ? Math.round((totalGuests / totalReservations) * 10) / 10
    : 0

  const kpi: AnalyticsKPI = { totalGuests, totalReservations, avgGuestsPerReservation }

  // --- Daily Traffic (last 30 days) ---
  const dailyMap = new Map<string, number>()

  // Pre-fill all 30 days so there are no gaps
  for (let i = 30; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dailyMap.set(formatDate(d), 0)
  }

  for (const r of last30Days) {
    const key = formatDate(r.reservationDate)
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + r.guests)
  }

  const dailyTraffic: DailyTraffic[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, guests]) => ({ date, guests }))

  // --- Peak Hours (last 90 days) ---
  const hourMap = new Map<number, number>()
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, 0)
  }

  for (const r of last90Days) {
    const hour = r.reservationTime.getUTCHours()
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + r.guests)
  }

  // Only include hours that have data
  const peakHours: PeakHour[] = Array.from(hourMap.entries())
    .filter(([, guests]) => guests > 0)
    .sort(([a], [b]) => a - b)
    .map(([hour, guests]) => ({ hour, guests }))

  // --- Party Size Distribution (last 90 days) ---
  let couples = 0
  let small = 0
  let large = 0

  for (const r of last90Days) {
    if (r.guests <= 2) couples++
    else if (r.guests <= 5) small++
    else large++
  }

  const partySizeDistribution: PartySizeDistribution[] = [
    { category: 'couples', count: couples },
    { category: 'small', count: small },
    { category: 'large', count: large },
  ].filter(d => d.count > 0)

  return { kpi, dailyTraffic, peakHours, partySizeDistribution }
}
