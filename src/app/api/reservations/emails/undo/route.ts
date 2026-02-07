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

    const { found } = await changeReservationStatus(emailId, 'rejected', 'confirmed')

    if (!found) {
      return NextResponse.json({ error: "Email reservation not found or not rejected" }, { status: 404 })
    }

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
