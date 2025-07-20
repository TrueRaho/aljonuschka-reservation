import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { databaseImporter } from '@/lib/importDB'
import type { ParsedEmailReservation } from '@/lib/IMAP-fetcher'

interface ImportRequestBody {
  emails: ParsedEmailReservation[]
}

export async function POST(request: NextRequest) {
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

    const body: ImportRequestBody = await request.json()

    if (!body.emails || !Array.isArray(body.emails)) {
      return NextResponse.json(
        { error: 'Invalid request body: emails array is required' },
        { status: 400 }
      )
    }

    console.log(`📥 Starting import of ${body.emails.length} emails...`)

    // Импортируем резервации в базу данных
    const importResult = await databaseImporter.importReservations(body.emails)

    const responseData = {
      success: importResult.success,
      totalEmails: body.emails.length,
      processedCount: importResult.processedCount,
      errorCount: importResult.errors.length,
      errors: importResult.errors,
      insertedEmails: importResult.insertedEmails.map(email => ({
        uid: email.uid,
        firstName: email.firstName,
        lastName: email.lastName,
        reservationDate: email.reservationDate,
        reservationTime: email.reservationTime,
        guests: email.guests,
      })),
    }

    console.log(
      `📊 Import summary: ${importResult.processedCount}/${body.emails.length} processed, ${importResult.errors.length} errors`
    )

    return NextResponse.json(responseData, {
      status: importResult.success ? 200 : 207, // 207 Multi-Status for partial success
    })
  } catch (error) {
    console.error('❌ Database import API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to import emails to database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}