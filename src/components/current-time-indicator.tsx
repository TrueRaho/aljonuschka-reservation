"use client"

import { useEffect, useState } from "react"
import { isSameDay } from "date-fns"

interface CurrentTimeIndicatorProps {
  startHour: number
  startMinute: number
  intervalMinutes: number
  slotHeight: number
  selectedDate: Date
}

export function CurrentTimeIndicator({
  startHour,
  startMinute,
  intervalMinutes,
  slotHeight,
  selectedDate,
}: CurrentTimeIndicatorProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [])

  // Only show the indicator if the selected date is today
  const isToday = isSameDay(selectedDate, new Date())
  if (!isToday) {
    return null
  }

  const currentHour = currentTime.getHours()
  const currentMinutes = currentTime.getMinutes()

  // Calculate position relative to start time
  const startTimeInMinutes = startHour * 60 + startMinute
  const currentTimeInMinutes = currentHour * 60 + currentMinutes

  // Only show if current time is within the schedule
  if (currentTimeInMinutes < startTimeInMinutes || currentTimeInMinutes > 22 * 60) {
    return null
  }

  const minutesFromStart = currentTimeInMinutes - startTimeInMinutes
  const slotsFromStart = minutesFromStart / intervalMinutes
  const topPosition = slotsFromStart * slotHeight

  const formatCurrentTime = () => {
    const hours = currentTime.getHours()
    const minutes = currentTime.getMinutes()
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
  }

  return (
    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${topPosition}px` }}>
      <div className="flex items-center">
        <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">{formatCurrentTime()}</div>
        <div className="flex-1 h-0.5 bg-red-500"></div>
      </div>
    </div>
  )
}
