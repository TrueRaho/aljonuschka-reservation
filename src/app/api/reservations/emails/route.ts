import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAllWithDateStats } from "@/services/reservationEmailService"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Проверка роли staff
    if (session.user.role !== "staff") {
      return NextResponse.json({ error: "Forbidden: Staff access only" }, { status: 403 })
    }

    const emailReservations = await getAllWithDateStats()
    return NextResponse.json(emailReservations)
  } catch (error) {
    console.error("Database error:", error)
    return NextResponse.json({ error: "Failed to fetch email reservations" }, { status: 500 })
  }
}
