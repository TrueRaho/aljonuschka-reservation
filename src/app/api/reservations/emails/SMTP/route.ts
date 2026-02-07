import { type NextRequest, NextResponse } from 'next/server'
import { mailService } from '@/services/mailService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { uid, type } = body

    if (!uid || !type) {
      return NextResponse.json({ error: 'Missing required fields: uid and type' }, { status: 400 })
    }

    if (!['confirmed', 'rejected', 'undo'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be: confirmed, rejected, or undo' }, { status: 400 })
    }

    const result = await mailService.sendNotificationEmail(uid, type)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Email sent successfully`,
      reservation: result.reservation,
    })
  } catch (error) {
    console.error('❌ SMTP API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
