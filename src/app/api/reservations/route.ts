import { type NextRequest, NextResponse } from "next/server"
import { getReservationsByDate } from "@/services/reservationEmailService"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    if (!date) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 })
    }

    const reservations = await getReservationsByDate(date)
    return NextResponse.json(reservations)
  } catch (error) {
    console.error("Database error:", error)
    return NextResponse.json({ error: "Failed to fetch reservations" }, { status: 500 })
  }
}
