"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Check, X, Undo2, Mail, Calendar, Users, Clock } from "lucide-react"
import { format } from "date-fns"
import { EmailReservation } from "@/types/email-reservations"

interface EmailReservationCardProps {
  reservation: EmailReservation
  onConfirm: (id: number) => Promise<void>
  onReject: (id: number) => Promise<void>
  onUndo: (id: number) => Promise<void>
}

export function EmailReservationCard({ reservation, onConfirm, onReject, onUndo }: EmailReservationCardProps) {
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

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy")
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "Time not specified"
    const [hours, minutes] = timeString.split(":")
    const hour = Number.parseInt(hours)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
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

  const displayName = reservation.last_name || reservation.email.split("@")[0]

  return (
    <Card className={`${getCardStyles()} transition-colors duration-200`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            {/* Header with sender info */}
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-medium text-white">{displayName}</p>
                <p className="text-sm text-gray-400">{reservation.email}</p>
              </div>
            </div>

            {/* Reservation details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300">{formatDate(reservation.reservation_date)}</span>
              </div>

              {reservation.reservation_time && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300">{formatTime(reservation.reservation_time)}</span>
                </div>
              )}

              {reservation.guests && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300">{reservation.guests} guests</span>
                </div>
              )}
            </div>

            {/* Special requests */}
            {reservation.special_requests && (
              <div className="text-sm">
                <p className="text-gray-400 mb-1">Special requests:</p>
                <p className="text-gray-300">{reservation.special_requests}</p>
              </div>
            )}
          </div>

          {/* Right side stats and actions */}
          <div className="flex flex-col items-end gap-3 ml-4">
            {/* Date stats */}
            <div className="text-right text-sm">
              <p className="text-gray-400">For {formatDate(reservation.reservation_date)}:</p>
              <p className="text-white font-medium">{reservation.confirmed_reservations} reservations</p>
              <p className="text-gray-300">{reservation.total_guests_for_date} total guests</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {reservation.status === "pending" && (
                <>
                  <Button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleReject} disabled={isLoading} size="sm" variant="destructive">
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}

              {reservation.status === "rejected" && (
                <Button
                  onClick={handleUndo}
                  disabled={isLoading}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Undo2 className="w-4 h-4 mr-1" />
                  Undo
                </Button>
              )}

              {reservation.status === "confirmed" && (
                <div className="flex items-center gap-1 text-green-400 text-sm">
                  <Check className="w-4 h-4" />
                  Confirmed
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
