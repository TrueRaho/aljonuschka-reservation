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

    console.log('📡 Starting IMAP email fetch...')

    // Получаем последний обработанный UID из базы данных
    const lastProcessedUid = await databaseImporter.getLastProcessedUid()
    console.log(`🔍 Last processed UID: ${lastProcessedUid}`)

    // Получаем новые письма через IMAP
    const parsedEmails = await imapFetcher.fetchEmails(lastProcessedUid)

    console.log(`📬 Found ${parsedEmails.length} new emails`)

    return NextResponse.json({
      success: true,
      emailsFound: parsedEmails.length,
      lastProcessedUid,
      emails: parsedEmails,
    })
  } catch (error) {
    console.error('❌ IMAP fetch error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch emails from IMAP server',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}