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

export type PeriodKey = '7d' | 'month' | '3m' | '6m' | '1y' | 'all'

function formatDate(dt: Date): string {
  return dt.toISOString().split('T')[0]
}

function getStartDate(period: PeriodKey): Date | null {
  const now = new Date()
  switch (period) {
    case '7d': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d
    }
    case 'month': {
      return new Date(now.getFullYear(), now.getMonth(), 1)
    }
    case '3m': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 3)
      return d
    }
    case '6m': {
      const d = new Date(now)
      d.setMonth(d.getMonth() - 6)
      return d
    }
    case '1y': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      return d
    }
    case 'all':
      return null
  }
}

function getDayCount(period: PeriodKey): number {
  const now = new Date()
  const start = getStartDate(period)
  if (!start) return 365 // for 'all', cap daily chart at 365 days
  return Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export interface AnalyticsPeriods {
  kpi: PeriodKey
  daily: PeriodKey
  peak: PeriodKey
  partySize: PeriodKey
}

export async function getAnalyticsData(periods: AnalyticsPeriods): Promise<AnalyticsData> {
  const now = new Date()

  // Collect unique date ranges needed
  const allPeriods = [periods.kpi, periods.daily, periods.peak, periods.partySize]
  const startDates = allPeriods.map(p => getStartDate(p))
  const earliestStart = startDates.some(d => d === null)
    ? null
    : startDates.reduce((min, d) => (d! < min! ? d : min))

  // Single query to get all needed data
  const allReservations = await prisma.reservationEmail.findMany({
    where: {
      status: 'confirmed',
      ...(earliestStart ? { reservationDate: { gte: earliestStart } } : {}),
    },
    select: {
      guests: true,
      reservationDate: true,
      reservationTime: true,
    },
  })

  // Helper to filter by period
  function filterByPeriod(period: PeriodKey) {
    const start = getStartDate(period)
    if (!start) return allReservations
    return allReservations.filter(r => r.reservationDate >= start)
  }

  // --- KPI ---
  const kpiData = filterByPeriod(periods.kpi)
  const totalGuests = kpiData.reduce((sum, r) => sum + r.guests, 0)
  const totalReservations = kpiData.length
  const avgGuestsPerReservation = totalReservations > 0
    ? Math.round((totalGuests / totalReservations) * 10) / 10
    : 0

  const kpi: AnalyticsKPI = { totalGuests, totalReservations, avgGuestsPerReservation }

  // --- Daily Traffic ---
  const dailyData = filterByPeriod(periods.daily)
  const dayCount = getDayCount(periods.daily)
  const dailyMap = new Map<string, number>()

  for (let i = dayCount; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dailyMap.set(formatDate(d), 0)
  }

  for (const r of dailyData) {
    const key = formatDate(r.reservationDate)
    if (dailyMap.has(key)) {
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + r.guests)
    }
  }

  const dailyTraffic: DailyTraffic[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, guests]) => ({ date, guests }))

  // --- Peak Hours ---
  const peakData = filterByPeriod(periods.peak)
  const hourMap = new Map<number, number>()
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, 0)
  }

  for (const r of peakData) {
    const hour = r.reservationTime.getUTCHours()
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + r.guests)
  }

  const peakHours: PeakHour[] = Array.from(hourMap.entries())
    .filter(([, guests]) => guests > 0)
    .sort(([a], [b]) => a - b)
    .map(([hour, guests]) => ({ hour, guests }))

  // --- Party Size Distribution ---
  const partySizeData = filterByPeriod(periods.partySize)
  let couples = 0
  let small = 0
  let large = 0

  for (const r of partySizeData) {
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
