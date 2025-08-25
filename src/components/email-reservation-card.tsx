"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Check, X, Minus, Undo2, Mail, Calendar, Users, Clock } from "lucide-react"
import { format } from "date-fns"
import { EmailReservation } from "@/types/email-reservations"

interface EmailReservationCardProps {
  reservation: EmailReservation
  onConfirm: (id: number) => Promise<void>
  onReject: (id: number) => Promise<void>
  onUndo: (id: number) => Promise<void>
  onConfirmSilent: (id: number) => Promise<void>
  onNameClick: (reservation: EmailReservation) => void
}

export function EmailReservationCard({ reservation, onConfirm, onReject, onUndo, onConfirmSilent, onNameClick }: EmailReservationCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm(reservation.id)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async () => {
    setIsLoading(true)
    try {
      await onReject(reservation.id)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUndo = async () => {
    setIsLoading(true)
    try {
      await onUndo(reservation.id)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmSilent = async () => {
    setIsLoading(true)
    try {
      await onConfirmSilent(reservation.id)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNameClick = () => onNameClick(reservation)

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy")
  }

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":")
    return `${hours}:${minutes}`
  }

  const getCardStyles = () => {
    switch (reservation.status) {
      case "confirmed":
        return "bg-green-900/20 border-green-700/50"
      case "rejected":
        return "bg-red-900/20 border-red-700/50"
      default:
        return "bg-gray-800 border-gray-700"
    }
  }

  const displayName = reservation.first_name || reservation.email.split("@")[0]

  return (
    <Card className={`${getCardStyles()} transition-colors duration-200`}>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          {/* Sender info - LEFT */}
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <Button
                variant="link"
                className="p-0 h-auto text-blue-400 hover:text-blue-300 font-medium truncate"
                onClick={handleNameClick}
              >
                {displayName}
              </Button>
              <p className="text-xs text-gray-400 truncate">{reservation.email}</p>
            </div>
          </div>

          {/* Reservation details - CENTER */}
          <div className="flex items-center gap-4 text-sm flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-gray-300 text-xs whitespace-nowrap">{formatDate(reservation.reservation_date)}</span>
            </div>

            {reservation.reservation_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-300 text-xs whitespace-nowrap">{formatTime(reservation.reservation_time)}</span>
              </div>
            )}

            {reservation.guests && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-300 text-xs whitespace-nowrap">{reservation.guests} гостей</span>
              </div>
            )}
          </div>

          {/* Reservation stats - RIGHT */}
          <div className="hidden md:flex items-center gap-4 text-xs text-gray-300 border-l border-gray-700 pl-4">
            <div className="flex flex-col">
              <span className="text-gray-400 text-[10px] uppercase tracking-wider">Записей</span>
              <span className="font-medium">{reservation.confirmed_reservations}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-[10px] uppercase tracking-wider">Гостей</span>
              <span className="font-medium">{reservation.total_guests_for_date}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {reservation.status === 'pending' && (
              <>
                <Button 
                  onClick={handleConfirm} 
                  disabled={isLoading} 
                  size="sm"
                  className="h-7 w-7 p-0 sm:h-7 sm:w-auto sm:px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  onClick={handleConfirmSilent} 
                  disabled={isLoading} 
                  size="sm"
                  className="h-7 w-7 p-0 sm:h-7 sm:w-auto sm:px-2 text-xs bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  onClick={handleReject} 
                  disabled={isLoading} 
                  size="sm" 
                  variant="destructive"
                  className="h-7 w-7 p-0 sm:h-7 sm:w-auto sm:px-2 text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {reservation.status === "rejected" && (
              <Button
                onClick={handleUndo}
                disabled={isLoading}
                size="sm"
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                <span className="sr-only sm:not-sr-only">Подтвердить</span>
              </Button>
            )}

            {reservation.status === "confirmed" && (
              <div className="flex items-center gap-1 text-green-400 text-xs px-2">
                <Check className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">Подтверждено</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

