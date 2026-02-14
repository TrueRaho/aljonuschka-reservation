import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAnalyticsData, type PeriodKey, type AnalyticsPeriods } from "@/services/analyticsService"

const VALID_PERIODS: PeriodKey[] = ['7d', 'month', '3m', '6m', '1y', 'all']

function parsePeriod(value: string | null, fallback: PeriodKey): PeriodKey {
  if (value && VALID_PERIODS.includes(value as PeriodKey)) return value as PeriodKey
  return fallback
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "staff") {
      return NextResponse.json({ error: "Forbidden: Staff access only" }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const periods: AnalyticsPeriods = {
      kpi: parsePeriod(searchParams.get('kpi'), 'month'),
      daily: parsePeriod(searchParams.get('daily'), 'month'),
      peak: parsePeriod(searchParams.get('peak'), '3m'),
      partySize: parsePeriod(searchParams.get('partySize'), '3m'),
    }

    const data = await getAnalyticsData(periods)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 })
  }
}
