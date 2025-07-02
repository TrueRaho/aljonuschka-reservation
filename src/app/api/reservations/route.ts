import { neon } from "@neondatabase/serverless";
import { type NextRequest, NextResponse } from "next/server"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    if (!date) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 })
    }

    const reservations = await sql`
      SELECT 
        id,
        first_name,
        last_name,
        phone,
        email,
        reservation_date,
        reservation_time,
        guests,
        special_requests
      FROM reservations 
      WHERE reservation_date = ${date}
      ORDER BY reservation_time ASC
    `

    return NextResponse.json(reservations)
  } catch (error) {
    console.error("Database error:", error)
    return NextResponse.json({ error: "Failed to fetch reservations" }, { status: 500 })
  }
}
