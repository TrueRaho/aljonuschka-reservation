import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { imapFetcher } from "@/lib/IMAP"
import { changeReservationStatus } from "@/services/reservationEmailService"

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

    const { found } = await changeReservationStatus(emailId, 'pending', 'rejected')

    if (!found) {
      return NextResponse.json({ error: "Email reservation not found or already processed" }, { status: 404 })
    }

    // Set \Seen flag in IMAP for the email
    const imapSuccess = await imapFetcher.setEmailSeen(emailId)
    if (!imapSuccess) {
      console.warn(`⚠️ Failed to set seen flag for UID ${emailId}, but reservation was rejected in DB`)
    }

    return NextResponse.json({
      success: true,
      imapFlagSet: imapSuccess
    })
  } catch (error) {
    console.error("Error rejecting reservation:", error)
    return NextResponse.json({ error: "Failed to reject reservation" }, { status: 500 })
  }
}
