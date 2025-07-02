"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import type { Reservation } from "@/types/reservation"
import { ReservationModal } from "@/components/reservation-modal"
import { ReservationCard } from "@/components/reservation-card"
import { CurrentTimeIndicator } from "@/components/current-time-indicator"
import { DatePicker } from "@/components/date-picker"

export default function ReservationsPage() {
  const [selectedDate, setSelectedDate] = useState(new Date(2025, 6, 2)) // July 2, 2025
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Generate time slots from 11:30 to 22:00 in 15-minute intervals
  const generateTimeSlots = () => {
    const slots = []
    const startHour = 11
    const startMinute = 30
    const endHour = 22
    const endMinute = 0

    let currentHour = startHour
    let currentMinute = startMinute

    while (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute)) {
      slots.push({
        time: `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`,
        hour: currentHour,
        minute: currentMinute,
      })

      currentMinute += 15
      if (currentMinute >= 60) {
        currentMinute = 0
        currentHour += 1
      }
    }

    return slots
  }

  const timeSlots = generateTimeSlots()
  const slotHeight = 60 // Height of each time slot in pixels

  useEffect(() => {
    const fetchReservations = async () => {
      setLoading(true)
      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd")
        const response = await fetch(`/api/reservations?date=${dateStr}`)
        if (response.ok) {
          const data = await response.json()
          setReservations(data)
        }
      } catch (error) {
        console.error("Failed to fetch reservations:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchReservations()
  }, [selectedDate])

  const getReservationsForTimeSlot = (time: string) => {
    return reservations.filter((reservation) => {
      const reservationTime = reservation.reservation_time.substring(0, 5) // Get HH:MM format
      return reservationTime === time
    })
  }

  const formatDateHeader = (date: Date) => {
    return format(date, "EEEE, MMMM d, yyyy")
  }

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation)
    setIsModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-light">{format(selectedDate, "d MMMM yyyy")}</h1>
            <DatePicker date={selectedDate} onDateChange={setSelectedDate} />
          </div>
          <p className="text-xl text-gray-400 font-light">{format(selectedDate, "EEEE")}</p>
        </div>

        {/* Schedule */}
        <div className="relative">
          <div className="grid grid-cols-[100px_1fr] gap-4">
            {/* Time labels column */}
            <div className="space-y-0">
              {timeSlots.map((slot, index) => (
                <div
                  key={slot.time}
                  className="text-gray-400 text-sm font-medium flex items-center justify-end pr-4 border-b border-gray-700"
                  style={{ height: `${slotHeight}px` }}
                >
                  {slot.time}
                </div>
              ))}
            </div>

            {/* Reservations column */}
            <div className="relative">
              {timeSlots.map((slot, index) => {
                const slotReservations = getReservationsForTimeSlot(slot.time)
                return (
                  <div
                    key={slot.time}
                    className="border-b border-gray-700 flex items-center gap-2 px-4"
                    style={{ height: `${slotHeight}px` }}
                  >
                    {loading ? (
                      <div className="text-gray-500 text-sm">Loading...</div>
                    ) : (
                      slotReservations.map((reservation) => (
                        <ReservationCard
                          key={reservation.id}
                          reservation={reservation}
                          onClick={() => handleReservationClick(reservation)}
                        />
                      ))
                    )}
                  </div>
                )
              })}

              {/* Current time indicator */}
              <CurrentTimeIndicator
                startHour={11}
                startMinute={30}
                intervalMinutes={15}
                slotHeight={slotHeight}
                selectedDate={selectedDate}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Modal */}
      <ReservationModal reservation={selectedReservation} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
