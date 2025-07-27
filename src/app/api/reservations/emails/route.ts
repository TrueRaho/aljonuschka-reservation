import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

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

    // Get all email reservations with counts for each date
    const emailReservations = await sql`
    WITH date_stats AS (
      SELECT 
        reservation_date,
        COUNT(*) as confirmed_count,
        COALESCE(SUM(guests), 0) as total_guests
      FROM reservation_emails 
      WHERE status = 'confirmed' 
      GROUP BY reservation_date
    )
    SELECT 
      re.id,
      re.first_name,
      re.last_name,
      re.phone,
      re.email,
      re.reservation_date,
      re.reservation_time,
      re.guests,
      re.special_requests,
      re.received_at,
      re.status,
      COALESCE(ds.confirmed_count, 0) as confirmed_reservations,
      COALESCE(ds.total_guests, 0) as total_guests_for_date
    FROM reservation_emails re
    LEFT JOIN date_stats ds ON re.reservation_date = ds.reservation_date
    ORDER BY 
      CASE 
        WHEN re.status = 'pending' THEN 0 
        ELSE 1 
      END,
      re.uid DESC
  `

    return NextResponse.json(emailReservations)
  } catch (error) {
    console.error("Database error:", error)
    return NextResponse.json({ error: "Failed to fetch email reservations" }, { status: 500 })
  }
}
