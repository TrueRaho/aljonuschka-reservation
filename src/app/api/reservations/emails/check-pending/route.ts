import { NextResponse } from 'next/server'
import { imapFetcher } from '@/lib/IMAP'

export async function POST() {
  try {
    console.log('🔍 Starting pending reservations check...')
    
    const result = await imapFetcher.checkPendingReservationsStatus()
    
    return NextResponse.json({
      success: true,
      message: 'Pending reservations check completed',
      data: result
    })
  } catch (error) {
    console.error('❌ Error checking pending reservations:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
