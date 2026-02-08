import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAnalyticsData } from "@/services/analyticsService"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "staff") {
      return NextResponse.json({ error: "Forbidden: Staff access only" }, { status: 403 })
    }

    const data = await getAnalyticsData()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 })
  }
}
