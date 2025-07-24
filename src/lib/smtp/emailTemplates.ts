import { EmailReservation } from '@/types/email-reservations';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type EmailType = 'confirmed' | 'rejected' | 'undo';

export function getEmailTemplate(type: EmailType, reservation: EmailReservation): { subject: string, html: string } {
  // Форматируем имя
  const fullName = `${reservation.first_name} ${reservation.last_name}`;
  
  // Форматируем дату и время
  const reservationDate = new Date(reservation.reservation_date);
  const formattedDate = format(reservationDate, 'dd.MM.yyyy', { locale: de });
  const formattedTime = reservation.reservation_time;
    switch (type) {
      case 'confirmed':
        return {
          subject: 'Bestätigung Ihrer Reservierung im Restaurant AljonuschkA',
          html: `<html>
                  <body>
                    <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
                      <h2>Reservierungsbestätigung</h2>
                      <p>Sehr geehrte/r ${fullName},</p>
                      <p>wir freuen uns, Sie in unserem Restaurant begrüßen zu dürfen und bestätigen Ihre Reservierung am <strong>${formattedDate}</strong> um <strong>${formattedTime} Uhr</strong>.</p>
                      <p>Sollten Sie Fragen oder besondere Wünsche haben, zögern Sie bitte nicht, uns zu kontaktieren.</p>
                      <p>Mit freundlichen Grüßen<br />Team „AljonuschkA“</p>
                    </div>
                  </body>
                </html>`
        }
      case 'rejected':
        return {
          subject: 'Ihre Reservierungsanfrage im Restaurant AljonuschkA',
          html: `<html>
                  <body>
                    <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
                      <h2>Reservierungsanfrage abgelehnt</h2>
                      <p>Sehr geehrte/r ${fullName},</p>
                      <p>leider haben wir für den von Ihnen gewählten Termin am <strong>${formattedDate}</strong> um <strong>${formattedTime} Uhr</strong> keine Plätze frei, wir bitten um Entschuldigung.</p>
                      <p>Wenn ein Tisch frei wird, werden wir Sie umgehend informieren.</p>
                      <p>Ich danke Ihnen im Voraus für Ihr Verständnis.</p>
                      <p>Mit freundlichen Grüßen<br />Team „AljonuschkA“</p>
                    </div>
                  </body>
                </html>`
        }
      case 'undo':
        return {
          subject: 'Verfügbarkeit für Ihre Reservierungsanfrage im Restaurant AljonuschkA',
          html: `<html>
                  <body>
                    <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
                      <h2>Verfügbarkeitsbenachrichtigung</h2>
                      <p>Sehr geehrte/r ${fullName},</p>
                      <p>Sie wollten vorher unser Restaurant am <strong>${formattedDate}</strong> um <strong>${formattedTime} Uhr</strong> besuchen, jetzt können wir einen Tisch für Sie reservieren.</p>
                      <p>Wenn Sie einverstanden sind, bestätigen Sie bitte.</p>
                      <p>Wir freuen uns darauf, von Ihnen zu hören.</p>
                      <p>Mit freundlichen Grüßen<br />Team „AljonuschkA“</p>
                    </div>
                  </body>
                </html>`
        }
      default:
        throw new Error('Unknown email type')
    }
}