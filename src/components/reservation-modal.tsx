"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Phone, Mail, Calendar, Users, Clock, MessageSquare } from "lucide-react"
import type { Reservation } from "@/types/reservation"

interface ReservationModalProps {
  reservation: Reservation | null
  isOpen: boolean
  onClose: () => void
}

export function ReservationModal({ reservation, isOpen, onClose }: ReservationModalProps) {
  if (!reservation) return null

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":")
    const hour = Number.parseInt(hours)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const handleCall = () => {
    window.open(`tel:${reservation.phone}`)
  }

  const handleEmail = () => {
    window.open(`mailto:${reservation.email}`)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Reservation Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">
              {reservation.first_name} {reservation.last_name}
            </h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-gray-400" />
              <Button variant="link" className="p-0 h-auto text-blue-400 hover:text-blue-300" onClick={handleCall}>
                {reservation.phone}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-gray-400" />
              <Button variant="link" className="p-0 h-auto text-blue-400 hover:text-blue-300" onClick={handleEmail}>
                {reservation.email}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-gray-300">{formatDate(reservation.reservation_date)}</span>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-gray-300">{formatTime(reservation.reservation_time)}</span>
            </div>

            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-gray-300">
                {reservation.guests} {reservation.guests === 1 ? "guest" : "guests"}
              </span>
            </div>

            {reservation.special_requests && (
              <div className="flex items-start gap-3">
                <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-400 mb-1">Special Requests:</p>
                  <p className="text-gray-300">{reservation.special_requests}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
