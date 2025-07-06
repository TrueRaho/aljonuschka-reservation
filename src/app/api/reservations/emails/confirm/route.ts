import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { emailId } = await request.json()

    if (!emailId) {
      return NextResponse.json({ error: "Email ID is required" }, { status: 400 })
    }

    // Get the email reservation details
    const emailReservation = await sql`
      SELECT * FROM reservation_emails WHERE id = ${emailId} AND status = 'pending'
    `

    if (emailReservation.length === 0) {
      return NextResponse.json({ error: "Email reservation not found or already processed" }, { status: 404 })
    }

    // Update email status to confirmed
    await sql`
      UPDATE reservation_emails 
      SET status = 'confirmed' 
      WHERE id = ${emailId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error confirming reservation:", error)
    return NextResponse.json({ error: "Failed to confirm reservation" }, { status: 500 })
  }
}
