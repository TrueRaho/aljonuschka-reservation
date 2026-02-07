import { ImapFlow } from 'imapflow'
import iconv from 'iconv-lite'
import { getMaxUid, checkExists, updateStatus, getPendingUids } from '@/services/reservationEmailService'

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
  newReservations: ParsedEmailReservation[]
  processedCount: number
  confirmedCount: number
  pendingCheckedCount: number
  pendingConfirmedCount: number
  errors: string[]
}

export interface EmailFlags {
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

interface ImapConfig {
  server: string
  port: number
  user: string
  password: string
}

class IMAPFetcher {
  private config: ImapConfig

  constructor() {
    this.config = {
      server: process.env.IMAP_SERVER!,
      port: parseInt(process.env.IMAP_PORT!, 10),
      user: process.env.EMAIL!,
      password: process.env.EMAIL_PASSWORD!,
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
    // Пробуем разные варианты регулярных выражений
    const patterns = [
      new RegExp(`${field}\\*?:\\s*([^\\r\\n]+)`, 'i'), // основной паттерн
      new RegExp(`${field}\\*?\\s*:\\s*([^\\r\\n]+)`, 'i'), // с пробелом перед двоеточием
      new RegExp(`${field}\\*?\\s*([^\\r\\n]+)`, 'i') // без двоеточия
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

  /**
   * Очищает поле special_requests от нежелательного текста
   */
  private cleanSpecialRequests(text: string): string {
    const unwantedText = 'Sie nutzen das Lust auf Dresden Reservierungssystem für Ihre Reservierungsanfrage. Lust auf Dresden ist der gröÃte Genuss-Guide für die Region. Hier k: Unchecked'
    const unwantedText2 = 'Sie nutzen das Lust auf Dresden Reservierungssystem für Ihre Reservierungsanfrage. Lust auf Dresden ist der gröÃte Genuss-Guide für die Region. Hier k: Checked'
    const unwantedText3 = 'Sie nutzen das Lust auf Dresden Reservierungssystem für Ihre Reservierungsanfrage. Lust auf Dresden ist der größte Genuss-Guide für die Region. Hier k: Checked'
    const unwantedText4 = 'Sie nutzen das Lust auf Dresden Reservierungssystem für Ihre Reservierungsanfrage. Lust auf Dresden ist der größte Genuss-Guide für die Region. Hier k: Unchecked'

    
    // Удаляем нежелательный текст
    let cleaned = text.replace(unwantedText, '').trim()
    cleaned = cleaned.replace(unwantedText2, '').trim()
    cleaned = cleaned.replace(unwantedText3, '').trim()
    cleaned = cleaned.replace(unwantedText4, '').trim()
    
    // Если после очистки поле пустое, возвращаем дефис
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
    
    // Пробуем разные варианты названий поля даты
    const dateStr = this.extractCleaned('Datum wählen', body, true) || 
                    this.extractCleaned('Datum wÃ¤hlen', body, true) || // UTF-8 неправильно декодировано
                    this.extractCleaned('Datum', body, true) ||
                    this.extractCleaned('Date', body, true)
    
    console.log(`📅 Raw date field: '${dateStr}'`)
    
    const timeStr = this.extractCleaned('Choose a time', body, true)
    const guestsRaw = this.extractCleaned('Anzahl Personen', body, true)
    const specialRequestsRaw = this.extractCleaned('Anmerkungen', body, true)
    const specialRequests = this.cleanSpecialRequests(specialRequestsRaw)
    
    console.log(`📅 Extracted date: '${dateStr}', time: '${timeStr}', guests: '${guestsRaw}'`)

    // Парсим количество гостей
    let guests = 1
    try {
      const guestsMatch = guestsRaw.match(/\d+/)
      guests = guestsMatch ? parseInt(guestsMatch[0], 10) : 1
    } catch {
      guests = 1
    }

    // Парсим дату (формат DD.MM.YYYY)
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

    // Парсим время (формат HH:MM)
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
      uid: 0, // Будет установлен позже
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

  async fetchAndProcessEmails(): Promise<EmailProcessingResult> {
    const result: EmailProcessingResult = {
      newReservations: [],
      processedCount: 0,
      confirmedCount: 0,
      pendingCheckedCount: 0,
      pendingConfirmedCount: 0,
      errors: []
    }

    const client = new ImapFlow({
      host: this.config.server,
      port: this.config.port,
      secure: true,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
    })

    try {
      await client.connect()
      const mailbox = await client.getMailboxLock('INBOX')

      try {
        // 1. Получаем максимальный UID из базы данных
        const maxUidFromDb = await getMaxUid()
        console.log(`📊 Max UID from database: ${maxUidFromDb}`)

        // 2. Поиск писем с нужной темой
        const searchResult = await client.search({
          subject: '[aljonuschka] Reservierungsanfragen - neue Einreichung',
        })

        if (!searchResult || !Array.isArray(searchResult) || searchResult.length === 0) {
          console.log('📭 No emails found with the specified subject')
          return result
        }

        // 3. Сортируем UID по убыванию (новые сначала)
        const uids = Array.from(searchResult).sort((a, b) => (b as number) - (a as number))
        console.log(`📬 Found ${uids.length} emails to process`)

        // 4. Обрабатываем письма до достижения maxUidFromDb
        for (const uid of uids) {
          const numericUid = uid as number
          
          // Останавливаемся, если достигли максимального UID из БД
          if (numericUid <= maxUidFromDb) {
            console.log(`🛑 Stopped at UID ${numericUid}, already processed (max DB UID: ${maxUidFromDb})`)
            break
          }

          try {
            // Получаем сообщение с флагами
            const message = await client.fetchOne(numericUid, {
              envelope: true,
              bodyStructure: true,
              source: true,
              flags: true
            })

            if (!message || typeof message === 'boolean') {
              console.log(`❌ Message not found for UID ${numericUid}`)
              continue
            }

            result.processedCount++

            // Проверяем флаги \Seen или \Answered
            const flags = this.extractEmailFlags(message.flags)
            const isReadOrAnswered = flags.seen || flags.answered

            console.log(`📧 UID ${numericUid}: seen=${flags.seen}, answered=${flags.answered}`)

            if (isReadOrAnswered) {
              // Если письмо уже прочитано или отвечено, обновляем статус в БД
              const exists = await checkExists(numericUid)
              if (exists) {
                await updateStatus(numericUid, 'confirmed')
                result.confirmedCount++
                console.log(`✅ UID ${numericUid} marked as confirmed (read/answered)`)
              }
              
              // Убеждаемся, что письмо помечено как прочитанное
              if (!flags.seen) {
                await client.messageFlagsAdd(numericUid, ['\\Seen'])
                console.log(`👁️ UID ${numericUid} marked as seen`)
              }
            } else {
              // Обрабатываем как новое письмо
              const parsedReservation = await this.parseEmailMessage(message, numericUid)
              if (parsedReservation) {
                result.newReservations.push(parsedReservation)
                console.log(`📝 UID ${numericUid} parsed as new reservation`)
              }
            }
          } catch (error) {
            const errorMessage = `Error processing UID ${numericUid}: ${error instanceof Error ? error.message : String(error)}`
            result.errors.push(errorMessage)
            console.error(`❌ ${errorMessage}`)
          }
        }

        console.log(`📈 New emails processing completed: ${result.processedCount} processed, ${result.newReservations.length} new, ${result.confirmedCount} confirmed`)
        
        // 3. Проверяем существующие pending резервации на флаг \Seen
        console.log('🔍 Checking existing pending reservations for \\Seen flag...')
        const pendingUids = await getPendingUids()
        console.log(`📋 Found ${pendingUids.length} pending reservations to check`)
        
        for (const uid of pendingUids) {
          try {
            result.pendingCheckedCount++
            
            // Получаем флаги сообщения по UID
            const message = await client.fetchOne(uid, {
              flags: true
            })

            if (!message || typeof message === 'boolean') {
              console.log(`⚠️ Message not found for UID ${uid}`)
              continue
            }

            // Проверяем флаги
            console.log(`🔍 UID ${uid} raw flags:`, message.flags)
            const flags = this.extractEmailFlags(message.flags)
            console.log(`🔍 UID ${uid} parsed flags:`, flags)
            
            if (flags.seen || flags.answered) {
              // Обновляем статус на confirmed
              const updated = await updateStatus(uid, 'confirmed')
              if (updated) {
                result.pendingConfirmedCount++
                console.log(`✅ UID ${uid} updated from pending to confirmed (seen=${flags.seen}, answered=${flags.answered})`)
              } else {
                result.errors.push(`Failed to update status for UID ${uid}`)
              }
            } else {
              console.log(`📧 UID ${uid} still pending (seen=${flags.seen}, answered=${flags.answered})`)
            }
          } catch (error) {
            const errorMessage = `Error checking pending UID ${uid}: ${error instanceof Error ? error.message : String(error)}`
            result.errors.push(errorMessage)
            console.error(`❌ ${errorMessage}`)
          }
        }
        
        console.log(`📊 Complete processing finished: ${result.processedCount} new processed, ${result.newReservations.length} new reservations, ${result.confirmedCount} confirmed from new, ${result.pendingCheckedCount} pending checked, ${result.pendingConfirmedCount} pending confirmed, ${result.errors.length} errors`)
        return result
      } finally {
        mailbox.release()
      }
    } finally {
      await client.logout()
    }
  }

  private extractEmailFlags(flags?: Set<string>): EmailFlags {
    if (!flags) {
      return { seen: false, answered: false }
    }
    
    return {
      seen: flags.has('\\Seen'),
      answered: flags.has('\\Answered')
    }
  }

  private async parseEmailMessage(message: ImapMessage, uid: number): Promise<ParsedEmailReservation | null> {
    try {
      if (!message.source) {
        console.log(`❌ No source for UID ${uid}`)
        return null
      }

      // Парсим email - работаем с сырыми байтами, чтобы не потерять кодировку
      let rawSource: Buffer
      if (Buffer.isBuffer(message.source)) {
        rawSource = message.source
      } else if (typeof message.source === 'string') {
        // Преобразуем строку в байты без потери данных
        rawSource = Buffer.from(message.source, 'latin1')
      } else {
        console.log(`❌ Unexpected source type for UID ${uid}: ${typeof message.source}`)
        return null
      }
      
      // Извлекаем дату получения
      const receivedAt = message.envelope?.date || new Date()

      // Извлекаем тело письма с учетом кодировок
      const body = this.extractEmailBody(rawSource)
      
      if (!body) {
        console.log(`❌ No body found for UID ${uid}`)
        return null
      }

      // Парсим данные резервации
      const parsedData = this.parseBody(body, receivedAt)
      parsedData.uid = uid
      
      return parsedData
    } catch (error) {
      console.error(`❌ Error parsing email UID ${uid}:`, error)
      return null
    }
  }

  async fetchEmails(lastProcessedUid = 0): Promise<ParsedEmailReservation[]> {
    const client = new ImapFlow({
      host: this.config.server,
      port: this.config.port,
      secure: true,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
    })

    try {
      await client.connect()
      const mailbox = await client.getMailboxLock('INBOX')

      try {
        // Поиск писем с нужной темой
        const searchResult = await client.search({
          subject: '[aljonuschka] Reservierungsanfragen - neue Einreichung',
        })

        // Проверяем результат поиска и обрабатываем случай когда писем нет
        if (!searchResult || !Array.isArray(searchResult) || searchResult.length === 0) {
          console.log('📭 No emails found with the specified subject')
          return []
        }

        // Сортируем UID по убыванию (новые сначала)
        const uids = Array.from(searchResult).sort((a, b) => (b as number) - (a as number))
        const parsedEmails: ParsedEmailReservation[] = []

        for (const uid of uids) {
          const numericUid = uid as number
          if (numericUid <= lastProcessedUid) {
            console.log(`🟡 Stopped at UID ${numericUid}, already processed.`)
            break
          }

          try {
            // Получаем полное сообщение
            const message = await client.fetchOne(numericUid, {
              envelope: true,
              bodyStructure: true,
              source: true,
            })

            // Проверяем, что сообщение найдено и имеет содержимое
            if (!message || typeof message === 'boolean') {
              console.log(`❌ Message not found for UID ${numericUid}`)
              continue
            }

            console.log(`🔍 Message source type: ${typeof message.source}`)
            console.log(`🔍 Message source preview: ${String(message.source).substring(0, 200)}...`)

            if (!message.source) {
              console.log(`❌ No source for UID ${numericUid}`)
              continue
            }

            // Парсим email - работаем с сырыми байтами, чтобы не потерять кодировку
            let rawSource: Buffer
            if (Buffer.isBuffer(message.source)) {
              rawSource = message.source
            } else if (typeof message.source === 'string') {
              // Преобразуем строку в байты без потери данных
              rawSource = Buffer.from(message.source, 'latin1')
            } else {
              console.log(`❌ Unexpected source type for UID ${numericUid}: ${typeof message.source}`)
              continue
            }
            
            // Извлекаем дату получения
            const receivedAt = message.envelope?.date || new Date()

            // Извлекаем тело письма с учетом кодировок
            const body = this.extractEmailBody(rawSource)
            
            console.log(`📝 Body length for UID ${numericUid}: ${body.length} characters`)
            console.log(`🔍 Body preview: ${body.substring(0, 200)}...`)
            console.log(`🔍 Raw email length: ${rawSource.length} bytes`)

            if (!body) {
              console.log(`❌ No body found for UID ${numericUid}`)
              continue
            }

            // Парсим данные резервации
            const parsedData = this.parseBody(body, receivedAt)
            parsedData.uid = numericUid
            
            parsedEmails.push(parsedData)
            console.log(`✅ Parsed UID ${numericUid}: ${parsedData.firstName} ${parsedData.lastName}`)
          } catch (error) {
            console.error(`❌ Error parsing UID ${numericUid}:`, error)
          }
        }

        return parsedEmails
      } finally {
        mailbox.release()
      }
    } finally {
      await client.logout()
    }
  }

  private extractEmailBody(rawEmail: Buffer): string {
    // Конвертируем в строку без потери байтов для парсинга заголовков и boundary
    const emailText: string = rawEmail.toString('latin1')
    // Поиск boundary для multipart сообщений - поддерживаем разные форматы
    const boundaryMatch = emailText.match(/boundary="([^"]+)"/i) || 
                         emailText.match(/boundary=([^\s;]+)/i)
    
    if (boundaryMatch) {
      const boundary = boundaryMatch[1]
      console.log(`🔍 Found boundary: ${boundary}`)
      console.log(`🔍 Looking for boundary parts with: --${boundary}`)
      
      // Разбиваем на части по boundary
      const parts = emailText.split(`--${boundary}`)
      console.log(`🔍 Found ${parts.length} boundary parts`)
      
      // Ищем text/plain часть
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        console.log(`🔍 Part ${i} preview: ${part.substring(0, 200)}...`)
        
        if (part.includes('Content-Type: text/plain')) {
          console.log(`✅ Found text/plain part at index ${i}`)
          
          // Пробуем разные варианты разделителей заголовков и body
          const bodyMatch = part.match(/\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$|$)/) || // двойной перенос
                           part.match(/Mime-Version: [^\r\n]*\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$|$)/) || // после Mime-Version
                           part.match(/charset=[^\r\n]*\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n$|$)/) // после charset
          
          console.log(`🔍 Trying to match body with different patterns...`)
          
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
          } else {
            console.log(`❌ No body match found in text/plain part`)
            console.log(`🔍 Part content for debugging: ${part}`)
          }
        }
      }
      
      // Если text/plain не найден, ищем text/html
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
      // Простое сообщение без multipart
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

  async setEmailSeen(uid: number): Promise<boolean> {
    const client = new ImapFlow({
      host: this.config.server,
      port: this.config.port,
      secure: true,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
    })

    try {
      await client.connect()
      const mailbox = await client.getMailboxLock('INBOX')

      try {
        // Устанавливаем флаг \Seen для указанного UID
        await client.messageFlagsAdd(uid, ['\\Seen'])
        console.log(`👁️ UID ${uid} marked as seen`)
        return true
      } finally {
        mailbox.release()
      }
    } catch (error) {
      console.error(`❌ Error setting seen flag for UID ${uid}:`, error)
      return false
    } finally {
      await client.logout()
    }
  }

  /**
   * Сохраняет отправленное письмо в папку Sent через IMAP
   */
  async appendToSent(emailData: {
    from: string;
    to: string;
    subject: string;
    html: string;
  }): Promise<boolean> {
    const client = new ImapFlow({
      host: this.config.server,
      port: this.config.port,
      secure: true,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
    })

    try {
      await client.connect()
      
      // Проверяем существование папки Sent (может называться по-разному)
      const sentFolders = ['Sent', 'INBOX.Sent', 'Sent Items', 'Отправленные']
      let sentFolder = 'Sent' // по умолчанию
      
      for (const folder of sentFolders) {
        try {
          await client.getMailboxLock(folder)
          sentFolder = folder
          break
        } catch {
          // Папка не существует, пробуем следующую
          continue
        }
      }

      // Формируем RFC 2822 сообщение
      const date = new Date().toUTCString()
      const messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@${this.config.server}>`
      
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
        emailData.html
      ].join('\r\n')

      // Добавляем письмо в папку Sent с флагом \Seen
      await client.append(sentFolder, rawMessage, ['\\Seen'])
      console.log(`📤 Email appended to ${sentFolder} folder`)
      return true
      
    } catch (error) {
      console.error('❌ Error appending email to Sent folder:', error)
      return false
    } finally {
      await client.logout()
    }
  }
}

export const imapFetcher = new IMAPFetcher()
export { IMAPFetcher }