import nodemailer, { SentMessageInfo } from 'nodemailer'
import { imapFetcher } from '../IMAP-fetcher'

interface EmailConfig {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailConfig): Promise<SentMessageInfo> {
  // Проверяем наличие необходимых переменных окружения
  const smtpServer = process.env.SMTP_SERVER
  const smtpPort = process.env.SMTP_PORT
  const email = process.env.EMAIL
  const emailPassword = process.env.EMAIL_PASSWORD

  if (!smtpServer || !smtpPort || !email || !emailPassword) {
    throw new Error('Missing SMTP configuration. Please check environment variables: SMTP_SERVER, SMTP_PORT, EMAIL, EMAIL_PASSWORD')
  }

  // Создаем транспорт для отправки писем
  const transporter = nodemailer.createTransport({
    host: smtpServer,
    port: parseInt(smtpPort, 10),
    secure: parseInt(smtpPort, 10) === 465, // true для 465, false для других портов
    auth: {
      user: email,
      pass: emailPassword,
    },
  })

  try {
    // Отправляем письмо
    const info = await transporter.sendMail({
      from: `"Aljonuschka Restaurant" <${email}>`,
      to,
      subject,
      html,
    })

    console.log('📧 Email sent successfully:', info.messageId)
    
    // Сохраняем отправленное письмо в папку Sent через IMAP
    try {
      const imapSuccess = await imapFetcher.appendToSent({
        from: `"Aljonuschka Restaurant" <${email}>`,
        to,
        subject,
        html,
      })
      
      if (imapSuccess) {
        console.log('📤 Email successfully saved to Sent folder')
      } else {
        console.warn('⚠️ Email sent but failed to save to Sent folder')
      }
    } catch (imapError) {
      console.warn('⚠️ Email sent but IMAP save failed:', imapError)
      // Не прерываем выполнение, так как письмо уже отправлено
    }
    
    return info
  } catch (error) {
    console.error('❌ Failed to send email:', error)
    throw new Error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`)
  }
}