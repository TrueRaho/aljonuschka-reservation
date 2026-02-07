"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Phone, Mail, Calendar, Users, Clock, MessageSquare, AlertTriangle, Send, ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { EmailReservationWithStats as EmailReservation } from "@/services/reservationEmailService"
import { emailTemplateOptions, getEmailTemplatePlainText } from "@/lib/smtp/emailTemplates"
import type { EmailType } from "@/lib/smtp/emailTemplates"

interface ReservationModalProps {
  reservation: EmailReservation | null
  isOpen: boolean
  onClose: () => void
}

export function ReservationModal({ reservation, isOpen, onClose }: ReservationModalProps) {
  const [isComposing, setIsComposing] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [isSending, setIsSending] = useState(false)

  if (!reservation) return null

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":")
    return `${hours}:${minutes}`
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

  const handleClose = () => {
    resetCompose()
    onClose()
  }

  const resetCompose = () => {
    setIsComposing(false)
    setSelectedTemplate("")
    setEmailSubject("")
    setEmailBody("")
  }

  const handleTemplateChange = (templateType: string) => {
    setSelectedTemplate(templateType)
    if (!templateType) {
      setEmailSubject("")
      setEmailBody("")
      return
    }

    const template = getEmailTemplatePlainText(templateType as EmailType, {
      first_name: reservation.first_name,
      last_name: reservation.last_name,
      reservation_date: reservation.reservation_date,
      reservation_time: reservation.reservation_time,
    })
    setEmailSubject(template.subject)
    setEmailBody(template.body)
  }

  const handleSend = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Тема и текст письма обязательны")
      return
    }

    setIsSending(true)
    try {
      const response = await fetch("/api/reservations/emails/send-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: reservation.email,
          subject: emailSubject,
          body: emailBody,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to send email")
      }

      toast.success(`Письмо отправлено: ${reservation.first_name} ${reservation.last_name}`)
      resetCompose()
    } catch (error) {
      console.error("Send email error:", error)
      toast.error("Не удалось отправить письмо")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        {!isComposing ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Детали брони</DialogTitle>
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
                    {reservation.guests} {reservation.guests === 1 ? "гость" : "гостей"}
                  </span>
                </div>

                {reservation.special_requests && (
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-300">{reservation.special_requests}</p>
                    </div>
                  </div>
                )}

                {reservation.strikes > 0 && (
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`h-4 w-4 ${reservation.strikes >= 3 ? 'text-red-400' : 'text-amber-400'}`} />
                    <span className={`${reservation.strikes >= 3 ? 'text-red-400 font-medium' : 'text-amber-400'}`}>
                      {reservation.strikes} {reservation.strikes === 1 ? 'страйк' : 'страйков'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => setIsComposing(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                Написать
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Написать письмо</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-xs">Кому</Label>
                <Input
                  value={reservation.email}
                  readOnly
                  className="bg-gray-800 border-gray-700 text-gray-400 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-400 text-xs">Шаблон</Label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-1 text-sm text-white shadow-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Без шаблона --</option>
                  {emailTemplateOptions.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-400 text-xs">Тема</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Тема письма..."
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-400 text-xs">Текст</Label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Текст письма..."
                  className="bg-gray-800 border-gray-700 text-white min-h-[200px]"
                />
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                onClick={resetCompose}
                variant="ghost"
                className="text-gray-400 hover:text-white"
                disabled={isSending}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
              <Button
                onClick={handleSend}
                disabled={isSending || !emailSubject.trim() || !emailBody.trim()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Отправить
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
