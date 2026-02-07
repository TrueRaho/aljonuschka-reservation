import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { mailService } from '@/services/mailService'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden: Staff access only' }, { status: 403 })
    }

    console.log('🚀 Starting IMAP email fetch and processing...')
    const result = await mailService.fetchAndProcessEmails()

    console.log('✅ Processing completed:', {
      totalProcessed: result.totalProcessed,
      newReservations: result.emailsFound,
      confirmedByFlags: result.confirmedByFlags,
      imported: result.imported,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ Error in IMAP processing:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process emails from IMAP server',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
