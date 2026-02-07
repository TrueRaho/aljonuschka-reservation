import { type NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { mailService } from '@/services/mailService'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden: Staff access only' }, { status: 403 })
    }

    const { to, subject, body } = await request.json()

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, and body' },
        { status: 400 }
      )
    }

    const result = await mailService.sendCustomEmail(to, subject, body)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Custom email API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to send custom email',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
