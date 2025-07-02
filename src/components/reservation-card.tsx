"use client"

import type { Reservation } from "@/types/reservation"

interface ReservationCardProps {
  reservation: Reservation
  onClick: () => void
}

export function ReservationCard({ reservation, onClick }: ReservationCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors duration-150 min-w-0 truncate"
    >
      {reservation.last_name} ({reservation.guests})
    </button>
  )
}
