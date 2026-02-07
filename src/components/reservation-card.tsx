"use client"

import { AlertTriangle } from "lucide-react"
import type { EmailReservationWithStats as EmailReservation } from "@/services/reservationEmailService"

interface ReservationCardProps {
  reservation: EmailReservation
  onClick: () => void
}

export function ReservationCard({ reservation, onClick }: ReservationCardProps) {
  const hasAlarmingStrikes = reservation.strikes >= 3

  return (
    <button
      onClick={onClick}
      className={`${hasAlarmingStrikes ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-2 py-1 rounded text-xs font-medium transition-colors duration-150 min-w-0 truncate flex items-center gap-1`}
    >
      {hasAlarmingStrikes && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
      {reservation.first_name} ({reservation.guests})
    </button>
  )
}
