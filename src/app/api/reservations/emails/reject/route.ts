import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { mailService } from "@/services/mailService"

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

    const result = await mailService.rejectReservation(emailId)
    if (!result.found) {
      return NextResponse.json({ error: "Email reservation not found or already processed" }, { status: 404 })
    }

    return NextResponse.json({ success: true, imapFlagSet: result.imapFlagSet })
  } catch (error) {
    console.error("Error rejecting reservation:", error)
    return NextResponse.json({ error: "Failed to reject reservation" }, { status: 500 })
  }
}
