import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { neon } from "@neondatabase/serverless"
import { imapFetcher } from "@/lib/IMAP"

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
      SELECT * FROM reservation_emails WHERE id = ${emailId} AND status = 'rejected'
    `

    if (emailReservation.length === 0) {
      return NextResponse.json({ error: "Email reservation not found or not rejected" }, { status: 404 })
    }

    // Update email status to confirmed
    await sql`
      UPDATE reservation_emails 
      SET status = 'confirmed' 
      WHERE id = ${emailId}
    `

    // Set \Seen flag in IMAP for the email
    const imapSuccess = await imapFetcher.setEmailSeen(emailId)
    if (!imapSuccess) {
      console.warn(`⚠️ Failed to set seen flag for UID ${emailId}, but undo was successful in DB`)
    }

    return NextResponse.json({ 
      success: true,
      imapFlagSet: imapSuccess
    })
  } catch (error) {
    console.error("Error undoing rejection:", error)
    return NextResponse.json({ error: "Failed to undo rejection" }, { status: 500 })
  }
}
