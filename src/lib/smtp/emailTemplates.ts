import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export type EmailType = 'confirmed' | 'rejected' | 'undo';

export interface EmailReservationForTemplate {
  first_name: string
  last_name: string
  reservation_date: string
  reservation_time: string
}

export const emailTemplateOptions = [
  { type: 'confirmed' as const, label: 'Bestätigung (Confirmation)' },
  { type: 'rejected' as const, label: 'Absage (Rejection)' },
  { type: 'undo' as const, label: 'Verfügbarkeit (Availability)' },
]

function formatReservation(reservation: EmailReservationForTemplate) {
  const fullName = `${reservation.first_name} ${reservation.last_name}`
  const reservationDate = new Date(reservation.reservation_date)
  const formattedDate = format(reservationDate, 'dd.MM.yyyy', { locale: de })
  const formattedTime = reservation.reservation_time
  return { fullName, formattedDate, formattedTime }
}

export function getEmailTemplate(type: EmailType, reservation: EmailReservationForTemplate): { subject: string, html: string } {
  const { fullName, formattedDate, formattedTime } = formatReservation(reservation)

  switch (type) {
    case 'confirmed':
      return {
        subject: 'Bestätigung Ihrer Reservierung im Restaurant AljonuschkA',
        html: `<html>
                <body>
                  <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333; border: 1px solid #ccc; border-radius: 8px; padding: 20px; max-width: 600px; margin: 20px auto; background-color: #fafafa;">
                    <h2>Reservierungsbestätigung</h2>
                    <p>Sehr geehrte/r ${fullName},</p>
                    <p>wir freuen uns, Sie in unserem Restaurant begrüßen zu dürfen und bestätigen Ihre Reservierung am <strong>${formattedDate}</strong> um <strong>${formattedTime} Uhr</strong>.</p>
                    <p>Sollten Sie Fragen oder besondere Wünsche haben, zögern Sie bitte nicht, uns zu kontaktieren.</p>
                    <p>Mit freundlichen Grüßen<br />Team „AljonuschkA"</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #999;">Bitte antworten Sie nicht auf diese E-Mail. Bei Fragen erreichen Sie uns telefonisch unter <strong>0351-33 94 83 77</strong>.</p>
                  </div>
                </body>
              </html>`
      }
    case 'rejected':
      return {
        subject: 'Ihre Reservierungsanfrage im Restaurant AljonuschkA',
        html: `<html>
                <body>
                  <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333; border: 1px solid #ccc; border-radius: 8px; padding: 20px; max-width: 600px; margin: 20px auto; background-color: #fafafa;">
                    <h2>Reservierungsanfrage abgelehnt</h2>
                    <p>Sehr geehrte/r ${fullName},</p>
                    <p>leider haben wir für den von Ihnen gewählten Termin am <strong>${formattedDate}</strong> um <strong>${formattedTime} Uhr</strong> keine Plätze frei, wir bitten um Entschuldigung.</p>
                    <p>Wenn ein Tisch frei wird, werden wir Sie umgehend informieren.</p>
                    <p>Ich danke Ihnen im Voraus für Ihr Verständnis.</p>
                    <p>Mit freundlichen Grüßen<br />Team „AljonuschkA"</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #999;">Bitte antworten Sie nicht auf diese E-Mail. Bei Fragen erreichen Sie uns telefonisch unter <strong>0351-33 94 83 77</strong>.</p>
                  </div>
                </body>
              </html>`
      }
    case 'undo':
      return {
        subject: 'Verfügbarkeit für Ihre Reservierungsanfrage im Restaurant AljonuschkA',
        html: `<html>
                <body>
                  <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333; border: 1px solid #ccc; border-radius: 8px; padding: 20px; max-width: 600px; margin: 20px auto; background-color: #fafafa;">
                    <h2>Verfügbarkeitsbenachrichtigung</h2>
                    <p>Sehr geehrte/r ${fullName},</p>
                    <p>Sie wollten vorher unser Restaurant am <strong>${formattedDate}</strong> um <strong>${formattedTime} Uhr</strong> besuchen, jetzt können wir einen Tisch für Sie reservieren.</p>
                    <p>Wenn Sie einverstanden sind, bestätigen Sie bitte.</p>
                    <p>Wir freuen uns darauf, von Ihnen zu hören.</p>
                    <p>Mit freundlichen Grüßen<br />Team „AljonuschkA"</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #999;">Bitte antworten Sie nicht auf diese E-Mail. Bei Fragen erreichen Sie uns telefonisch unter <strong>0351-33 94 83 77</strong>.</p>
                  </div>
                </body>
              </html>`
      }
    default:
      throw new Error('Unknown email type')
  }
}

export function getEmailTemplatePlainText(type: EmailType, reservation: EmailReservationForTemplate): { subject: string, body: string } {
  const { fullName, formattedDate, formattedTime } = formatReservation(reservation)

  switch (type) {
    case 'confirmed':
      return {
        subject: 'Bestätigung Ihrer Reservierung im Restaurant AljonuschkA',
        body: `Sehr geehrte/r ${fullName},

wir freuen uns, Sie in unserem Restaurant begrüßen zu dürfen und bestätigen Ihre Reservierung am ${formattedDate} um ${formattedTime} Uhr.

Sollten Sie Fragen oder besondere Wünsche haben, zögern Sie bitte nicht, uns zu kontaktieren.

Mit freundlichen Grüßen
Team „AljonuschkA"

---
Bitte antworten Sie nicht auf diese E-Mail. Bei Fragen erreichen Sie uns telefonisch unter 0351-33 94 83 77.`,
      }
    case 'rejected':
      return {
        subject: 'Ihre Reservierungsanfrage im Restaurant AljonuschkA',
        body: `Sehr geehrte/r ${fullName},

leider haben wir für den von Ihnen gewählten Termin am ${formattedDate} um ${formattedTime} Uhr keine Plätze frei, wir bitten um Entschuldigung.

Wenn ein Tisch frei wird, werden wir Sie umgehend informieren.

Ich danke Ihnen im Voraus für Ihr Verständnis.

Mit freundlichen Grüßen
Team „AljonuschkA"

---
Bitte antworten Sie nicht auf diese E-Mail. Bei Fragen erreichen Sie uns telefonisch unter 0351-33 94 83 77.`,
      }
    case 'undo':
      return {
        subject: 'Verfügbarkeit für Ihre Reservierungsanfrage im Restaurant AljonuschkA',
        body: `Sehr geehrte/r ${fullName},

Sie wollten vorher unser Restaurant am ${formattedDate} um ${formattedTime} Uhr besuchen, jetzt können wir einen Tisch für Sie reservieren.

Wenn Sie einverstanden sind, bestätigen Sie bitte.

Wir freuen uns darauf, von Ihnen zu hören.

Mit freundlichen Grüßen
Team „AljonuschkA"

---
Bitte antworten Sie nicht auf diese E-Mail. Bei Fragen erreichen Sie uns telefonisch unter 0351-33 94 83 77.`,
      }
    default:
      throw new Error('Unknown email type')
  }
}

export function wrapTextInHtmlEmail(text: string): string {
  const htmlBody = text
    .split('\n')
    .map(line => line.trim() === '' ? '</p><p>' : line)
    .join('<br />')

  return `<html>
  <body>
    <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333; border: 1px solid #ccc; border-radius: 8px; padding: 20px; max-width: 600px; margin: 20px auto; background-color: #fafafa;">
      <p>${htmlBody}</p>
    </div>
  </body>
</html>`
}
