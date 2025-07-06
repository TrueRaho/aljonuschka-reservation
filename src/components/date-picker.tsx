"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns"
import { useState } from "react"

interface DatePickerProps {
  date: Date
  onDateChange: (date: Date) => void
}

export function DatePicker({ date, onDateChange }: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(date)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  // Get all days to display (including previous/next month days to fill the grid)
  const startDate = new Date(monthStart)
  startDate.setDate(startDate.getDate() - monthStart.getDay()) // Start from Sunday

  const endDate = new Date(monthEnd)
  const daysToAdd = 6 - monthEnd.getDay() // End on Saturday
  endDate.setDate(endDate.getDate() + daysToAdd)

  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const dayHeaders = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

  const handleDateSelect = (selectedDate: Date) => {
    onDateChange(selectedDate)
  }

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(date, "PPP")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 bg-gray-800 border-gray-600">
        <div className="space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="text-white hover:bg-gray-700">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-white font-medium">{format(currentMonth, "MMMM yyyy")}</h3>
            <Button variant="ghost" size="sm" onClick={handleNextMonth} className="text-white hover:bg-gray-700">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {dayHeaders.map((day) => (
              <div key={day} className="h-8 w-8 flex items-center justify-center text-xs font-medium text-gray-400">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {days.map((day) => {
              const isSelected = isSameDay(day, date)
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isToday = isSameDay(day, new Date())

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDateSelect(day)}
                  className={`
                    h-8 w-8 flex items-center justify-center text-xs font-medium rounded-full
                    transition-colors duration-150
                    ${
                      isSelected
                        ? "bg-red-500 text-white"
                        : isToday
                          ? "bg-gray-600 text-white"
                          : isCurrentMonth
                            ? "text-white hover:bg-gray-700"
                            : "text-gray-500 hover:bg-gray-700"
                    }
                  `}
                >
                  {format(day, "d")}
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
