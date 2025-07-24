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
          html: `Sehr geehrte/r ${fullName},
                wir freuen uns, Sie in unserem Restaurant begrüßen zu dürfen und bestätigen Ihre Reservierung am ${formattedDate} um ${formattedTime} Uhr.  

                Sollten Sie Fragen oder besondere Wünsche für einen bevorstehenden Besuch haben, zögern Sie bitte nicht, uns zu kontaktieren.


                Mit freundlichen Grüßen 
                Team „AljonuschkA"`
        }
      case 'rejected':
        return {
          subject: 'Ihre Reservierungsanfrage im Restaurant AljonuschkA',
          html: `Sehr geehrte/r ${fullName},
                leider haben wir für den von Ihnen gewählten Termin am ${formattedDate} um ${formattedTime} Uhr keine Plätze frei, wir bitten um Entschuldigung.

                Wenn ein Tisch frei wird, werden wir Sie umgehend informieren.

                Ich danke Ihnen im Voraus für Ihr Verständnis.



                Mit freundlichen Grüßen 
                Team „AljonuschkA"`
        }
      case 'undo':
        return {
          subject: 'Verfügbarkeit für Ihre Reservierungsanfrage im Restaurant AljonuschkA',
          html: `Sehr geehrte/r ${fullName},
                Sie wollten vorher unser Restaurant am ${formattedDate} um ${formattedTime} Uhr besuchen, jetzt können wir einen Tisch für Sie reservieren. 

                Wenn Sie einverstanden sind, bestätigen Sie bitte.

                Wir freuen uns darauf, von Ihnen zu hören.


                Mit freundlichen Grüßen 
                Team „AljonuschkA"`
        }
      default:
        throw new Error('Unknown email type')
    }
}