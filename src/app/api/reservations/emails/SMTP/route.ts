import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/smtp/SMTP'
import { getEmailTemplate } from '@/lib/smtp/emailTemplates'
import { getReservationById } from '@/services/reservationEmailService'

interface EmailRequestBody {
  uid: number;
  type: 'confirmed' | 'rejected' | 'undo';
}

export async function POST(request: NextRequest) {
  try {
    // Парсим тело запроса
    const body: EmailRequestBody = await request.json()
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
    const reservation = await getReservationById(uid)

    if (!reservation) {
      return NextResponse.json(
        { error: `Reservation with id ${uid} not found` },
        { status: 404 }
      )
    }

    console.log(`📧 Found reservation for: ${reservation.first_name} ${reservation.last_name}`)

    // Получаем шаблон письма
    const emailTemplate = getEmailTemplate(type, reservation)

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
