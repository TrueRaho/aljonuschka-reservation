import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { incrementStrike, decrementStrike, getStrikesByEmail } from "@/services/strikeService"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { email, action } = await request.json()
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    let newCount: number
    if (action === "decrement") {
      newCount = await decrementStrike(email)
    } else {
      newCount = await incrementStrike(email)
    }

    return NextResponse.json({ success: true, email, strikes: newCount })
  } catch (error) {
    console.error("Error managing strike:", error)
    return NextResponse.json({ error: "Failed to manage strike" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")
    if (!email) {
      return NextResponse.json({ error: "Email parameter is required" }, { status: 400 })
    }

    const strikes = await getStrikesByEmail(email)
    return NextResponse.json({ email, strikes })
  } catch (error) {
    console.error("Error fetching strikes:", error)
    return NextResponse.json({ error: "Failed to fetch strikes" }, { status: 500 })
  }
}
