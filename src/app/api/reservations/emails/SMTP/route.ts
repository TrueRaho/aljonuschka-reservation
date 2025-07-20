import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { sendEmail } from '@/lib/smtp/SMTP-sender'
import { getEmailTemplate } from '@/lib/smtp/emailTemplates'

const sql = neon(process.env.DATABASE_URL!)

interface RequestBody {
  uid: number;
  type: 'confirmed' | 'rejected' | 'undo';
}

interface ReservationEmail {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  reservation_date: string;
  reservation_time: string;
  guests: number;
  special_requests?: string;
  status: string;
}

export async function POST(request: NextRequest) {
  try {
    // Парсим тело запроса
    const body: RequestBody = await request.json()
    const { uid, type } = body

    if (!uid || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: uid and type' },
        { status: 400 }
      )
    }

    if (!['confirmed', 'rejected', 'undo'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: confirmed, rejected, or undo' },
        { status: 400 }
      )
    }

    // Находим резервацию в базе данных по uid
    console.log(`🔍 Looking for reservation with id: ${uid}`)
    const reservations = await sql`
      SELECT id, first_name, last_name, email, reservation_date, reservation_time, guests, special_requests, status
      FROM reservation_emails 
      WHERE id = ${uid}
    `

    if (reservations.length === 0) {
      return NextResponse.json(
        { error: `Reservation with id ${uid} not found` },
        { status: 404 }
      )
    }

    const reservation = reservations[0] as ReservationEmail
    console.log(`📧 Found reservation for: ${reservation.first_name} ${reservation.last_name}`)

    // Получаем шаблон письма
    const emailTemplate = getEmailTemplate(type)
    
    // Отправляем письмо
    await sendEmail({
      to: reservation.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    })

    console.log(`✅ Email sent successfully to ${reservation.email} for reservation ${uid}`)

    return NextResponse.json({
      success: true,
      message: `Email sent successfully to ${reservation.email}`,
      reservation: {
        id: reservation.id,
        name: `${reservation.first_name} ${reservation.last_name}`,
        email: reservation.email,
        type,
      },
    })
  } catch (error) {
    console.error('❌ SMTP API Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}