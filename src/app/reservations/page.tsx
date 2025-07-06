"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, Fragment } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { LogOut, Mail } from "lucide-react"
import type { Reservation } from "@/types/reservation"
import { ReservationModal } from "@/components/reservation-modal"
import { ReservationCard } from "@/components/reservation-card"
import { CurrentTimeIndicator } from "@/components/current-time-indicator"
import { DatePicker } from "@/components/date-picker"

export default function ReservationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return // Still loading

    if (!session) {
      router.push("/login")
      return
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

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation)
    setIsModalOpen(true)
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" })
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Загрузка...</div>
      </div>
    )
  }

  if (!session) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header with logout */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-light">{format(selectedDate, "d MMMM yyyy")}</h1>
              <DatePicker date={selectedDate} onDateChange={setSelectedDate} />
            </div>
            <div className="flex items-center gap-4">
              {/* <div className="flex items-center gap-2 text-gray-400">
                <User className="w-4 h-4" />
                <span className="capitalize">{session.user?.role}</span>
              </div> */}
              <Button
                onClick={() => router.push('/reservations/emails')}
                variant="outline"
                size="sm"
                className="border-gray-600 text-white hover:bg-gray-700 bg-transparent"
              >
                <Mail className="w-4 h-4 mr-2" />
                Письма
              </Button>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="border-gray-600 text-white hover:bg-gray-700 bg-transparent"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Выйти
              </Button>
            </div>
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
                        <div className="text-gray-500 text-sm">Загрузка...</div>
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
      <ReservationModal reservation={selectedReservation} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
