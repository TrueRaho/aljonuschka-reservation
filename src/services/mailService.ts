import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import iconv from 'iconv-lite'
import { getEmailTemplate } from '@/lib/smtp/emailTemplates'
import {
  importReservations,
  getMaxUid,
  checkExists,
  updateStatus,
  getPendingUids,
  getReservationById,
  changeReservationStatus,
} from '@/services/reservationEmailService'

// --- Types ---

export interface ParsedEmailReservation {
  uid: number
  firstName: string
  lastName: string
  phone: string
  email: string
  reservationDate: string // YYYY-MM-DD format
  reservationTime: string // HH:MM format
  guests: number
  specialRequests: string
  receivedAt: string // ISO string
}

export interface EmailProcessingResult {
  success: boolean
  emailsFound: number
  totalProcessed: number
  confirmedByFlags: number
  pendingChecked: number
  pendingConfirmed: number
  errors: number
  imported: number
  emails: ParsedEmailReservation[]
  details: {
    errors: string[]
    importErrors: string[]
  }
}

export interface ConfirmResult {
  found: boolean
  imapFlagSet: boolean
  error?: string
}

export interface RejectResult {
  found: boolean
  imapFlagSet: boolean
  error?: string
}

export interface UndoResult {
  found: boolean
  imapFlagSet: boolean
  error?: string
}

export interface SendResult {
  success: boolean
  reservation?: {
    id: number
    name: string
    email: string
    type: string
  }
  error?: string
}

interface EmailFlags {
  seen: boolean
  answered: boolean
}

interface ImapMessage {
  source?: Buffer | string
  envelope?: {
    date?: Date
  }
  flags?: Set<string>
}

type EmailType = 'confirmed' | 'rejected' | 'undo'

// --- MailService ---

class MailService {
  private imapConfig: { host: string; port: number; secure: boolean; auth: { user: string; pass: string } }
  private smtpConfig: { host: string; port: number; secure: boolean; auth: { user: string; pass: string } }
  private readonly CONNECTION_TIMEOUT = 30_000
  private readonly OPERATION_TIMEOUT = 120_000

  constructor() {
    this.imapConfig = {
      host: process.env.IMAP_SERVER!,
      port: parseInt(process.env.IMAP_PORT!, 10),
      secure: true,
      auth: {
        user: process.env.EMAIL!,
        pass: process.env.EMAIL_PASSWORD!,
      },
    }

    this.smtpConfig = {
      host: process.env.SMTP_SERVER!,
      port: parseInt(process.env.SMTP_PORT!, 10),
      secure: parseInt(process.env.SMTP_PORT!, 10) === 465,
      auth: {
        user: process.env.EMAIL!,
        pass: process.env.EMAIL_PASSWORD!,
      },
    }
  }

  // --- Connection helpers ---

  private createImapClient(): ImapFlow {
    return new ImapFlow({
      host: this.imapConfig.host,
      port: this.imapConfig.port,
      secure: this.imapConfig.secure,
      auth: this.imapConfig.auth,
      logger: false,
    })
  }

  private async withImapConnection<T>(operation: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = this.createImapClient()
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    try {
      // Connection timeout
      const connectPromise = client.connect()
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('IMAP connection timeout'))
        }, this.CONNECTION_TIMEOUT)
      })
      await Promise.race([connectPromise, timeoutPromise])
      if (timeoutId) clearTimeout(timeoutId)

      // Operation timeout
      const operationPromise = operation(client)
      const opTimeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('IMAP operation timeout'))
        }, this.OPERATION_TIMEOUT)
      })
      const result = await Promise.race([operationPromise, opTimeoutPromise])
      if (timeoutId) clearTimeout(timeoutId)

      return result
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      try {
        await client.logout()
      } catch {
        // Already closed or failed - ignore
      }
    }
  }

  private async withMailboxLock<T>(
    client: ImapFlow,
    mailbox: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const lock = await client.getMailboxLock(mailbox)
    try {
      return await operation()
    } finally {
      lock.release()
    }
  }

  private createSmtpTransporter() {
    return nodemailer.createTransport({
      host: this.smtpConfig.host,
      port: this.smtpConfig.port,
      secure: this.smtpConfig.secure,
      auth: this.smtpConfig.auth,
    })
  }

  // --- High-level orchestration methods ---

  async fetchAndProcessEmails(): Promise<EmailProcessingResult> {
    const errors: string[] = []
    let totalProcessed = 0
    let confirmedByFlags = 0
    let pendingChecked = 0
    let pendingConfirmed = 0
    const newReservations: ParsedEmailReservation[] = []

    try {
      await this.withImapConnection(async (client) => {
        await this.withMailboxLock(client, 'INBOX', async () => {
          // 1. Get max UID from database
          const maxUidFromDb = await getMaxUid()
          console.log(`📊 Max UID from database: ${maxUidFromDb}`)

          // 2. Search for emails with the target subject
          const searchResult = await client.search({
            subject: '[aljonuschka] Reservierungsanfragen - neue Einreichung',
          })

          if (!searchResult || !Array.isArray(searchResult) || searchResult.length === 0) {
            console.log('📭 No emails found with the specified subject')
            return
          }

          // 3. Sort UIDs descending (newest first)
          const uids = Array.from(searchResult).sort((a, b) => (b as number) - (a as number))
          console.log(`📬 Found ${uids.length} emails to process`)

          // 4. Process emails until we reach maxUidFromDb
          for (const uid of uids) {
            const numericUid = uid as number

            if (numericUid <= maxUidFromDb) {
              console.log(`🛑 Stopped at UID ${numericUid}, already processed (max DB UID: ${maxUidFromDb})`)
              break
            }

            try {
              const message = await client.fetchOne(numericUid, {
                envelope: true,
                bodyStructure: true,
                source: true,
                flags: true,
              })

              if (!message || typeof message === 'boolean') {
                console.log(`❌ Message not found for UID ${numericUid}`)
                continue
              }

              totalProcessed++

              const flags = this.extractEmailFlags(message.flags)
              const isReadOrAnswered = flags.seen || flags.answered

              console.log(`📧 UID ${numericUid}: seen=${flags.seen}, answered=${flags.answered}`)

              if (isReadOrAnswered) {
                const exists = await checkExists(numericUid)
                if (exists) {
                  await updateStatus(numericUid, 'confirmed')
                  confirmedByFlags++
                  console.log(`✅ UID ${numericUid} marked as confirmed (read/answered)`)
                }

                if (!flags.seen) {
                  await client.messageFlagsAdd(numericUid, ['\\Seen'])
                  console.log(`👁️ UID ${numericUid} marked as seen`)
                }
              } else {
                const parsedReservation = await this.parseEmailMessage(message, numericUid)
                if (parsedReservation) {
                  newReservations.push(parsedReservation)
                  console.log(`📝 UID ${numericUid} parsed as new reservation`)
                }
              }
            } catch (error) {
              const errorMessage = `Error processing UID ${numericUid}: ${error instanceof Error ? error.message : String(error)}`
              errors.push(errorMessage)
              console.error(`❌ ${errorMessage}`)
            }
          }

          console.log(`📈 New emails processing completed: ${totalProcessed} processed, ${newReservations.length} new, ${confirmedByFlags} confirmed`)

          // 5. Check existing pending reservations for \Seen flag
          console.log('🔍 Checking existing pending reservations for \\Seen flag...')
          const pendingUids = await getPendingUids()
          console.log(`📋 Found ${pendingUids.length} pending reservations to check`)

          for (const uid of pendingUids) {
            try {
              pendingChecked++

              const message = await client.fetchOne(uid, { flags: true })
              if (!message || typeof message === 'boolean') {
                console.log(`⚠️ Message not found for UID ${uid}`)
                continue
              }

              console.log(`🔍 UID ${uid} raw flags:`, message.flags)
              const flags = this.extractEmailFlags(message.flags)
              console.log(`🔍 UID ${uid} parsed flags:`, flags)

              if (flags.seen || flags.answered) {
                const updated = await updateStatus(uid, 'confirmed')
                if (updated) {
                  pendingConfirmed++
                  console.log(`✅ UID ${uid} updated from pending to confirmed`)
                } else {
                  errors.push(`Failed to update status for UID ${uid}`)
                }
              } else {
                console.log(`📧 UID ${uid} still pending`)
              }
            } catch (error) {
              const errorMessage = `Error checking pending UID ${uid}: ${error instanceof Error ? error.message : String(error)}`
              errors.push(errorMessage)
              console.error(`❌ ${errorMessage}`)
            }
          }
        })
      })
    } catch (error) {
      const errorMessage = `IMAP processing failed: ${error instanceof Error ? error.message : String(error)}`
      errors.push(errorMessage)
      console.error(`❌ ${errorMessage}`)
    }

    // Import new reservations to database
    let importResult = null
    if (newReservations.length > 0) {
      console.log(`📥 Importing ${newReservations.length} new reservations...`)
      importResult = await importReservations(newReservations)
    }

    console.log(`📊 Complete processing finished: ${totalProcessed} processed, ${newReservations.length} new, ${confirmedByFlags} confirmed, ${pendingChecked} pending checked, ${pendingConfirmed} pending confirmed, ${errors.length} errors`)

    return {
      success: errors.length === 0,
      emailsFound: newReservations.length,
      totalProcessed,
      confirmedByFlags,
      pendingChecked,
      pendingConfirmed,
      errors: errors.length,
      imported: importResult?.processedCount || 0,
      emails: newReservations,
      details: {
        errors,
        importErrors: importResult?.errors || [],
      },
    }
  }

  async confirmReservation(emailId: number): Promise<ConfirmResult> {
    const { found } = await changeReservationStatus(emailId, 'pending', 'confirmed')
    if (!found) {
      return { found: false, imapFlagSet: false }
    }

    let imapFlagSet = false
    try {
      imapFlagSet = await this.setEmailSeen(emailId)
    } catch (error) {
      console.warn(`⚠️ Failed to set seen flag for UID ${emailId}:`, error)
    }

    return { found: true, imapFlagSet }
  }

  async rejectReservation(emailId: number): Promise<RejectResult> {
    const { found } = await changeReservationStatus(emailId, 'pending', 'rejected')
    if (!found) {
      return { found: false, imapFlagSet: false }
    }

    let imapFlagSet = false
    try {
      imapFlagSet = await this.setEmailSeen(emailId)
    } catch (error) {
      console.warn(`⚠️ Failed to set seen flag for UID ${emailId}:`, error)
    }

    return { found: true, imapFlagSet }
  }

  async undoRejection(emailId: number): Promise<UndoResult> {
    const { found } = await changeReservationStatus(emailId, 'rejected', 'confirmed')
    if (!found) {
      return { found: false, imapFlagSet: false }
    }

    let imapFlagSet = false
    try {
      imapFlagSet = await this.setEmailSeen(emailId)
    } catch (error) {
      console.warn(`⚠️ Failed to set seen flag for UID ${emailId}:`, error)
    }

    return { found: true, imapFlagSet }
  }

  async sendNotificationEmail(uid: number, type: EmailType): Promise<SendResult> {
    // Get reservation from database
    const reservation = await getReservationById(uid)
    if (!reservation) {
      return { success: false, error: `Reservation with id ${uid} not found` }
    }

    console.log(`📧 Found reservation for: ${reservation.first_name} ${reservation.last_name}`)

    // Get email template
    const emailTemplate = getEmailTemplate(type, reservation)
    const fromAddress = `"Aljonuschka Restaurant" <${this.smtpConfig.auth.user}>`

    // Send via SMTP
    try {
      const transporter = this.createSmtpTransporter()
      const info = await transporter.sendMail({
        from: fromAddress,
        to: reservation.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      })
      console.log('📧 Email sent successfully:', info.messageId)
    } catch (error) {
      console.error('❌ Failed to send email:', error)
      return { success: false, error: `Failed to send email: ${error instanceof Error ? error.message : String(error)}` }
    }

    // Save to IMAP Sent folder
    try {
      await this.appendToSent({
        from: fromAddress,
        to: reservation.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      })
    } catch (error) {
      console.warn('⚠️ Email sent but IMAP save failed:', error)
    }

    console.log(`✅ Email sent successfully to ${reservation.email} for reservation ${uid}`)

    return {
      success: true,
      reservation: {
        id: reservation.id,
        name: `${reservation.first_name} ${reservation.last_name}`,
        email: reservation.email,
        type,
      },
    }
  }

  // --- IMAP operations ---

  private async setEmailSeen(uid: number): Promise<boolean> {
    try {
      return await this.withImapConnection(async (client) => {
        return await this.withMailboxLock(client, 'INBOX', async () => {
          await client.messageFlagsAdd(uid, ['\\Seen'])
          console.log(`👁️ UID ${uid} marked as seen`)
          return true
        })
      })
    } catch (error) {
      console.error(`❌ Error setting seen flag for UID ${uid}:`, error)
      return false
    }
  }

  private async appendToSent(emailData: {
    from: string
    to: string
    subject: string
    html: string
  }): Promise<boolean> {
    try {
      return await this.withImapConnection(async (client) => {
        // Try different Sent folder names
        const sentFolders = ['Sent', 'INBOX.Sent', 'Sent Items', 'Отправленные']
        let sentFolder = 'Sent'

        for (const folder of sentFolders) {
          try {
            const lock = await client.getMailboxLock(folder)
            sentFolder = folder
            lock.release()
            break
          } catch {
            continue
          }
        }

        // Build RFC 2822 message
        const date = new Date().toUTCString()
        const messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@${this.imapConfig.host}>`

        const rawMessage = [
          `From: ${emailData.from}`,
          `To: ${emailData.to}`,
          `Subject: ${emailData.subject}`,
          `Date: ${date}`,
          `Message-ID: ${messageId}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=utf-8`,
          `Content-Transfer-Encoding: quoted-printable`,
          '',
          emailData.html,
        ].join('\r\n')

        await client.append(sentFolder, rawMessage, ['\\Seen'])
        console.log(`📤 Email appended to ${sentFolder} folder`)
        return true
      })
    } catch (error) {
      console.error('❌ Error appending email to Sent folder:', error)
      return false
    }
  }

  // --- Email parsing methods ---

  private extractEmailFlags(flags?: Set<string>): EmailFlags {
    if (!flags) {
      return { seen: false, answered: false }
    }
    return {
      seen: flags.has('\\Seen'),
      answered: flags.has('\\Answered'),
    }
  }

  private async parseEmailMessage(message: ImapMessage, uid: number): Promise<ParsedEmailReservation | null> {
    try {
      if (!message.source) {
        console.log(`❌ No source for UID ${uid}`)
        return null
      }

      let rawSource: Buffer
      if (Buffer.isBuffer(message.source)) {
        rawSource = message.source
      } else if (typeof message.source === 'string') {
        rawSource = Buffer.from(message.source, 'latin1')
      } else {
        console.log(`❌ Unexpected source type for UID ${uid}: ${typeof message.source}`)
        return null
      }

      const receivedAt = message.envelope?.date || new Date()
      const body = this.extractEmailBody(rawSource)

      if (!body) {
        console.log(`❌ No body found for UID ${uid}`)
        return null
      }

      const parsedData = this.parseBody(body, receivedAt)
      parsedData.uid = uid

      return parsedData
    } catch (error) {
      console.error(`❌ Error parsing email UID ${uid}:`, error)
      return null
    }
  }

  private stripHtmlTags(text: string): string {
    const clean = text.replace(/<[^>]+>/g, '')
    return this.unescapeHtml(clean).trim()
  }

  private unescapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
    }
    return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => htmlEntities[entity] || entity)
  }

  private extractCleaned(
    field: string,
    body: string,
    stripHtml = false,
    fallback = ''
  ): string {
    const patterns = [
      new RegExp(`${field}\\*?:\\s*([^\\r\\n]+)`, 'i'),
      new RegExp(`${field}\\*?\\s*:\\s*([^\\r\\n]+)`, 'i'),
      new RegExp(`${field}\\*?\\s*([^\\r\\n]+)`, 'i'),
    ]

    for (const regex of patterns) {
      const match = body.match(regex)
      if (match && match[1]) {
        const raw = match[1].trim()
        if (raw) {
          return stripHtml ? this.stripHtmlTags(raw) : raw
        }
      }
    }

    return fallback
  }

  private formatName(name: string): string {
    return name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase()
  }

  private formatPhone(phone: string): string {
    const cleanPhone = phone.trim()
    if (cleanPhone.startsWith('+')) {
      return cleanPhone
    }
    const withoutLeadingZero = cleanPhone.replace(/^0/, '')
    return `+49${withoutLeadingZero}`
  }

  private cleanSpecialRequests(text: string): string {
    const unwantedTexts = [
      'Sie nutzen das Lust auf Dresden Reservierungssystem für Ihre Reservierungsanfrage. Lust auf Dresden ist der gröÃte Genuss-Guide für die Region. Hier k: Unchecked',
      'Sie nutzen das Lust auf Dresden Reservierungssystem für Ihre Reservierungsanfrage. Lust auf Dresden ist der gröÃte Genuss-Guide für die Region. Hier k: Checked',
      'Sie nutzen das Lust auf Dresden Reservierungssystem für Ihre Reservierungsanfrage. Lust auf Dresden ist der größte Genuss-Guide für die Region. Hier k: Checked',
      'Sie nutzen das Lust auf Dresden Reservierungssystem für Ihre Reservierungsanfrage. Lust auf Dresden ist der größte Genuss-Guide für die Region. Hier k: Unchecked',
    ]

    let cleaned = text
    for (const unwanted of unwantedTexts) {
      cleaned = cleaned.replace(unwanted, '').trim()
    }

    if (!cleaned) {
      return '-'
    }

    return cleaned
  }

  private parseBody(body: string, receivedAt: Date): ParsedEmailReservation {
    const firstName = this.formatName(this.extractCleaned('Vorname', body, true))
    const lastName = this.formatName(this.extractCleaned('Nachname', body, true))
    const phone = this.formatPhone(this.extractCleaned('Telefon', body, true))
    const email = this.extractCleaned('E-Mail-Adresse', body, true)

    const dateStr = this.extractCleaned('Datum wählen', body, true) ||
                    this.extractCleaned('Datum wÃ¤hlen', body, true) ||
                    this.extractCleaned('Datum', body, true) ||
                    this.extractCleaned('Date', body, true)

    console.log(`📅 Raw date field: '${dateStr}'`)

    const timeStr = this.extractCleaned('Choose a time', body, true)
    const guestsRaw = this.extractCleaned('Anzahl Personen', body, true)
    const specialRequestsRaw = this.extractCleaned('Anmerkungen', body, true)
    const specialRequests = this.cleanSpecialRequests(specialRequestsRaw)

    console.log(`📅 Extracted date: '${dateStr}', time: '${timeStr}', guests: '${guestsRaw}'`)

    let guests = 1
    try {
      const guestsMatch = guestsRaw.match(/\d+/)
      guests = guestsMatch ? parseInt(guestsMatch[0], 10) : 1
    } catch {
      guests = 1
    }

    let reservationDate: string
    try {
      const dateParts = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
      if (!dateParts) {
        throw new Error(`Invalid date format: ${dateStr}`)
      }
      const [, day, month, year] = dateParts
      reservationDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    } catch {
      throw new Error(`Invalid or missing reservation date: '${dateStr}'`)
    }

    let reservationTime: string
    try {
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/)
      if (!timeMatch) {
        throw new Error(`Invalid time format: ${timeStr}`)
      }
      const [, hours, minutes] = timeMatch
      reservationTime = `${hours.padStart(2, '0')}:${minutes}`
    } catch {
      throw new Error(`Invalid or missing reservation time: '${timeStr}'`)
    }

    return {
      uid: 0,
      firstName,
      lastName,
      phone,
      email,
      reservationDate,
      reservationTime,
      guests,
      specialRequests,
      receivedAt: receivedAt.toISOString(),
    }
  }

  private extractEmailBody(rawEmail: Buffer): string {
    const emailText: string = rawEmail.toString('latin1')
    const boundaryMatch = emailText.match(/boundary="([^"]+)"/i) ||
                         emailText.match(/boundary=([^\s;]+)/i)

    if (boundaryMatch) {
      const boundary = boundaryMatch[1]
      console.log(`🔍 Found boundary: ${boundary}`)
      const parts = emailText.split(`--${boundary}`)
      console.log(`🔍 Found ${parts.length} boundary parts`)

      // Try text/plain first
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (part.includes('Content-Type: text/plain')) {
          console.log(`✅ Found text/plain part at index ${i}`)
          const bodyMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$|$)/) ||
                           part.match(/Mime-Version: [^\r\n]*\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$|$)/) ||
                           part.match(/charset=[^\r\n]*\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$|$)/)

          if (bodyMatch && bodyMatch[1]) {
            const rawBodyText: string = bodyMatch[1].trim()
            const charset: string = this.getCharsetFromPart(part)
            const cte: string = this.getContentTransferEncoding(part)
            let bytes: Buffer
            if (cte === 'base64') {
              bytes = Buffer.from(rawBodyText.replace(/\s+/g, ''), 'base64')
            } else if (cte === 'quoted-printable') {
              console.log(`🔄 Decoding quoted-printable...`)
              bytes = this.decodeQuotedPrintableToBuffer(rawBodyText)
            } else {
              bytes = Buffer.from(rawBodyText, 'latin1')
            }
            const extractedBody: string = iconv.decode(bytes, charset)
            console.log(`✅ Extracted text/plain body: ${extractedBody.length} chars (charset=${charset}, cte=${cte})`)
            return extractedBody
          }
        }
      }

      // Fallback to text/html
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (part.includes('Content-Type: text/html')) {
          console.log(`✅ Found text/html part at index ${i}`)
          const bodyMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$|$)/) ||
                           part.match(/Mime-Version: [^\r\n]*\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$|$)/) ||
                           part.match(/charset=[^\r\n]*\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$|$)/)

          if (bodyMatch && bodyMatch[1]) {
            const rawBodyText: string = bodyMatch[1].trim()
            const charset: string = this.getCharsetFromPart(part)
            const cte: string = this.getContentTransferEncoding(part)
            let bytes: Buffer
            if (cte === 'base64') {
              bytes = Buffer.from(rawBodyText.replace(/\s+/g, ''), 'base64')
            } else if (cte === 'quoted-printable') {
              bytes = this.decodeQuotedPrintableToBuffer(rawBodyText)
            } else {
              bytes = Buffer.from(rawBodyText, 'latin1')
            }
            const decodedHtml: string = iconv.decode(bytes, charset)
            const extractedBody: string = this.stripHtmlTags(decodedHtml)
            console.log(`✅ Extracted text/html body: ${extractedBody.length} chars (charset=${charset}, cte=${cte})`)
            return extractedBody
          }
        }
      }
    } else {
      // Simple message without multipart
      const simpleBodyMatch = emailText.match(/\n\n([\s\S]*?)$/)
      if (simpleBodyMatch && simpleBodyMatch[1]) {
        const headersSectionMatch = emailText.match(/^[\s\S]*?\n\n/)
        const headersText: string = headersSectionMatch ? headersSectionMatch[0] : ''
        const charset: string = this.getCharsetFromHeaders(headersText)
        const cte: string = this.getContentTransferEncoding(headersText)
        const rawBodyText: string = simpleBodyMatch[1].trim()
        let bytes: Buffer
        if (cte === 'base64') {
          bytes = Buffer.from(rawBodyText.replace(/\s+/g, ''), 'base64')
        } else if (cte === 'quoted-printable') {
          bytes = this.decodeQuotedPrintableToBuffer(rawBodyText)
        } else {
          bytes = Buffer.from(rawBodyText, 'latin1')
        }
        const decoded: string = iconv.decode(bytes, charset)
        console.log(`✅ Extracted simple body: ${decoded.length} chars (charset=${charset}, cte=${cte})`)
        return decoded.trim()
      }
    }

    console.log(`❌ No body found in email`)
    return ''
  }

  private decodeQuotedPrintableToBuffer(text: string): Buffer {
    const softBreaksRemoved: string = text.replace(/=\r?\n/g, '')
    const bytes: number[] = []
    for (let i = 0; i < softBreaksRemoved.length; i += 1) {
      const ch: string = softBreaksRemoved[i]
      if (ch === '=' && i + 2 < softBreaksRemoved.length) {
        const hex: string = softBreaksRemoved.substring(i + 1, i + 3)
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16))
          i += 2
          continue
        }
      }
      bytes.push(softBreaksRemoved.charCodeAt(i))
    }
    return Buffer.from(bytes)
  }

  private getCharsetFromPart(part: string): string {
    return this.getCharsetFromHeaders(part)
  }

  private getCharsetFromHeaders(headersText: string, defaultCharset: string = 'utf-8'): string {
    const m = headersText.match(/charset\s*=\s*"?([a-zA-Z0-9._-]+)"?/i)
    return (m && m[1]) ? m[1].toLowerCase() : defaultCharset
  }

  private getContentTransferEncoding(sectionText: string): string {
    const m = sectionText.match(/content-transfer-encoding:\s*([a-z0-9-]+)/i)
    return (m && m[1]) ? m[1].toLowerCase() : '7bit'
  }
}

export const mailService = new MailService()
