import { neon } from '@neondatabase/serverless'
import type { ParsedEmailReservation } from './IMAP'

const sql = neon(process.env.DATABASE_URL!)

export interface ImportResult {
  success: boolean
  processedCount: number
  errors: string[]
  insertedEmails: ParsedEmailReservation[]
}

export class DatabaseImporter {
  async importReservations(emails: ParsedEmailReservation[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      processedCount: 0,
      errors: [],
      insertedEmails: [],
    }

    if (emails.length === 0) {
      return result
    }

    try {
      // Проверяем, какие UID уже существуют в базе данных
      const existingUids = await this.getExistingUids(emails.map(e => e.uid))
      const newEmails = emails.filter(email => !existingUids.includes(email.uid))

      console.log(`📊 Total emails: ${emails.length}, New emails: ${newEmails.length}, Already exist: ${existingUids.length}`)

      // Импортируем только новые письма
      for (const email of newEmails) {
        try {
          await this.insertSingleReservation(email)
          result.insertedEmails.push(email)
          result.processedCount++
          console.log(`✅ Imported UID ${email.uid}: ${email.firstName} ${email.lastName}`)
        } catch (error) {
          const errorMessage = `Failed to import UID ${email.uid}: ${error instanceof Error ? error.message : String(error)}`
          result.errors.push(errorMessage)
          result.success = false
          console.error(`❌ ${errorMessage}`)
        }
      }

      console.log(`📈 Import completed: ${result.processedCount} processed, ${result.errors.length} errors`)
      return result
    } catch (error) {
      result.success = false
      result.errors.push(`Database import failed: ${error instanceof Error ? error.message : String(error)}`)
      console.error('❌ Database import failed:', error)
      return result
    }
  }

  private async getExistingUids(uids: number[]): Promise<number[]> {
    if (uids.length === 0) return []

    try {
      // Используем neon с параметрами для IN clause
      const result = await sql`
        SELECT id FROM reservation_emails 
        WHERE id = ANY(${uids})
      `
      
      return result.map((row) => {
        // Проверяем наличие id и его тип
        const id = typeof row.id === 'number' ? row.id : Number(row.id);
        return id;
      })
    } catch (error) {
      console.error('Error checking existing UIDs:', error)
      return []
    }
  }

  private async insertSingleReservation(email: ParsedEmailReservation): Promise<void> {
    try {
      // Используем SQL-функцию из create-email-function.sql
      await sql`
        SELECT insert_reservation_email(
          ${email.uid}::BIGINT,
          ${email.firstName}::VARCHAR,
          ${email.lastName}::VARCHAR,
          ${email.phone}::VARCHAR,
          ${email.email}::VARCHAR,
          ${email.reservationDate}::DATE,
          ${email.reservationTime}::TIME,
          ${email.guests}::INTEGER,
          ${email.specialRequests || null}::TEXT
        )
      `
    } catch (error) {
      // Если функция не существует, используем прямой INSERT
      if (error instanceof Error && error.message.includes('function insert_reservation_email')) {
        console.log('📝 SQL function not found, using direct INSERT')
        await this.insertDirectly(email)
      } else {
        throw error
      }
    }
  }

  private async insertDirectly(email: ParsedEmailReservation): Promise<void> {
    await sql`
      INSERT INTO reservation_emails (
        id, first_name, last_name, phone, email,
        reservation_date, reservation_time, guests,
        special_requests, received_at, status
      ) VALUES (
        ${email.uid},
        ${email.firstName},
        ${email.lastName},
        ${email.phone},
        ${email.email},
        ${email.reservationDate},
        ${email.reservationTime},
        ${email.guests},
        ${email.specialRequests || null},
        ${email.receivedAt},
        'pending'
      )
    `
  }

  async getLastProcessedUid(): Promise<number> {
    try {
      const result = await sql`SELECT MAX(id) as max_id FROM reservation_emails`
      return (result[0]?.max_id as number) || 0
    } catch (error) {
      console.error('Error getting last processed UID:', error)
      return 0
    }
  }

  async updateReservationStatus(uid: number, status: 'pending' | 'confirmed' | 'rejected'): Promise<boolean> {
    try {
      await sql`
        UPDATE reservation_emails 
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${uid}
      `
      console.log(`✅ Updated UID ${uid} status to ${status}`)
      return true
    } catch (error) {
      console.error(`❌ Error updating status for UID ${uid}:`, error)
      return false
    }
  }

  async getMaxUidFromDatabase(): Promise<number> {
    return this.getLastProcessedUid()
  }

  async checkReservationExists(uid: number): Promise<boolean> {
    try {
      const result = await sql`
        SELECT id FROM reservation_emails WHERE id = ${uid}
      `
      return result.length > 0
    } catch (error) {
      console.error(`❌ Error checking reservation existence for UID ${uid}:`, error)
      return false
    }
  }
}

export const databaseImporter = new DatabaseImporter()