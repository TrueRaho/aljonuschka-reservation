import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { imapFetcher } from '@/lib/IMAP-fetcher'
import { databaseImporter } from '@/lib/importDB'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Проверка роли staff
    if (session.user.role !== 'staff') {
      return NextResponse.json(
        { error: 'Forbidden: Staff access only' },
        { status: 403 }
      )
    }

    console.log('🚀 Starting optimized IMAP email fetch and processing...')
    
    // Используем новый оптимизированный метод
    const processingResult = await imapFetcher.fetchAndProcessEmails()
    
    // Импортируем новые резервации в базу данных
    let importResult = null
    if (processingResult.newReservations.length > 0) {
      console.log(`📥 Importing ${processingResult.newReservations.length} new reservations...`)
      importResult = await databaseImporter.importReservations(processingResult.newReservations)
    }
    
    const response = {
      success: true,
      emailsFound: processingResult.newReservations.length,
      totalProcessed: processingResult.processedCount,
      confirmedByFlags: processingResult.confirmedCount,
      errors: processingResult.errors.length,
      imported: importResult?.processedCount || 0,
      emails: processingResult.newReservations,
      details: {
        errors: processingResult.errors,
        importErrors: importResult?.errors || []
      }
    }
    
    console.log('✅ Optimized processing completed:', {
      totalProcessed: response.totalProcessed,
      newReservations: response.emailsFound,
      confirmedByFlags: response.confirmedByFlags,
      imported: response.imported
    })
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Error in optimized IMAP processing:', error)
    
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