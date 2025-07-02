"use client"

import { useState, useEffect, Fragment } from "react"
import { format } from "date-fns"
import type { Reservation } from "@/types/reservation"
import { ReservationModal } from "@/components/reservation-modal"
import { ReservationCard } from "@/components/reservation-card"
import { CurrentTimeIndicator } from "@/components/current-time-indicator"
import { DatePicker } from "@/components/date-picker"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export default function ReservationsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [selectedDate, setSelectedDate] = useState(new Date(2025, 6, 2)) // July 2, 2025
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return

    if (session) {
      // User is logged in, redirect based on role
      if (session.user?.role === "admin") {
        router.push("/admin-only")
      } else if (session.user?.role === "staff") {
        router.push("/reservations")
      }
    } else {
      // User is not logged in, redirect to login
      router.push("/login")
    }
  }, [session, status, router])

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
          {/* Grid with two columns: time labels and reservations. Each iteration outputs a pair of cells so they share the same row height. */}
          <div className="relative">
            <div className="grid grid-cols-[100px_1fr] gap-x-4">
              {timeSlots.map((slot) => {
                const slotReservations = getReservationsForTimeSlot(slot.time)
                return (
                  <Fragment key={slot.time}>
                    {/* Time label */}
                    <div
                      className="text-gray-400 text-sm font-medium flex items-start justify-end pr-4 border-b border-gray-700 py-2"
                      style={{ minHeight: `${slotHeight}px` }}
                    >
                      {slot.time}
                    </div>

                    {/* Reservations cell */}
                    <div
                      className="border-b border-gray-700 flex flex-wrap items-start gap-2 px-4 py-2"
                      style={{ minHeight: `${slotHeight}px` }}
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
                  </Fragment>
                )
              })}
            </div>

            {/* Current time indicator overlay */}
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
      {/* Reservation Modal */}
      <ReservationModal reservation={selectedReservation} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
