"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, RefreshCw } from "lucide-react"
import { EmailReservationCard } from "@/components/email-reservation-card"
import { toast } from "sonner"
import type { EmailReservationWithStats as EmailReservation } from "@/services/reservationEmailService"
import { ReservationModal } from "@/components/reservation-modal"

export default function EmailReservationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [emailReservations, setEmailReservations] = useState<EmailReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<EmailReservation | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    if (status === "loading") return

    if (!session) {
      router.push("/login")
      return
    }
  }, [session, status, router])

  const fetchEmailReservations = useCallback(async () => {
    try {
      const response = await fetch("/api/reservations/emails")
      if (response.ok) {
        const data = await response.json()
        setEmailReservations(data)
      } else {
        throw new Error("Не вышло достать email-записи")
      }
    } catch (error) {
      console.error("Failed to fetch email reservations:", error)
      toast.error("Не вышло загрузить email-записи")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (session) {
      fetchEmailReservations()
    }
  }, [session, fetchEmailReservations])

  const handleRefresh = async () => {
    setRefreshing(true)

    try {
      console.log('🚀 Fetching and processing emails from IMAP...')
      const response = await fetch('/api/reservations/emails/IMAP')

      if (!response.ok) {
        throw new Error(`IMAP processing failed: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📊 Processing result:', {
        totalProcessed: data.totalProcessed,
        newReservations: data.emailsFound,
        confirmedByFlags: data.confirmedByFlags,
        pendingChecked: data.pendingChecked,
        pendingConfirmed: data.pendingConfirmed,
        imported: data.imported
      })

      if (data.success) {
        if (data.totalProcessed === 0) {
          toast.info("Новых писем не найдено")
        } else {
          const messages = []
          if (data.emailsFound > 0) {
            messages.push(`${data.emailsFound} новых резерваций`)
          }
          if (data.confirmedByFlags > 0) {
            messages.push(`${data.confirmedByFlags} подтверждено из новых`)
          }
          if (data.pendingConfirmed > 0) {
            messages.push(`${data.pendingConfirmed} pending подтверждено`)
          }

          let description = ''
          if (data.totalProcessed > 0) {
            description += `Обработано ${data.totalProcessed} новых писем`
          }
          if (data.pendingChecked > 0) {
            if (description) description += ', '
            description += `проверено ${data.pendingChecked} pending`
          }
          if (messages.length > 0) {
            if (description) description += ': '
            description += messages.join(', ')
          }

          toast.success(description || "Операция завершена")
        }
      } else {
        toast.error(`Ошибок: ${data.errors}. Проверьте логи для деталей.`)
      }

      await fetchEmailReservations()

    } catch (error) {
      console.error('❌ Refresh error:', error)
      toast.error(`Не удалось обновить резервации: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setRefreshing(false)
    }
  }

  const handleConfirm = async (emailId: number) => {
    try {
      const response = await fetch("/api/reservations/emails/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      })

      if (!response.ok) {
        throw new Error("Не вышло подтвердить запись")
      }

      try {
        const smtpResponse = await fetch("/api/reservations/emails/SMTP", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: emailId, type: "confirmed" }),
        })

        if (smtpResponse.ok) {
          toast.success("Запись подтверждена и письмо отправлено клиенту")
        } else {
          toast.warning("Запись подтверждена, но не удалось отправить письмо клиенту")
        }
      } catch (smtpError) {
        console.error("SMTP Error:", smtpError)
        toast.warning("Запись подтверждена, но не удалось отправить письмо клиенту")
      }

      await fetchEmailReservations()
    } catch (error) {
      console.error("Error confirming reservation:", error)
      toast.error("Не вышло подтвердить запись")
    }
  }

  const handleConfirmSilent = async (emailId: number) => {
    try {
      const response = await fetch("/api/reservations/emails/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      })
      if (!response.ok) {
        throw new Error("Не вышло подтвердить запись")
      }
      const data = await response.json()
      toast.success(data?.imapFlagSet ? "Статус обновлен, письмо помечено как прочитанное (без отправки клиенту)" : "Статус обновлен (не удалось пометить письмо прочитанным)")
      await fetchEmailReservations()
    } catch (error) {
      console.error("Error silent confirming reservation:", error)
      toast.error("Не вышло подтвердить запись без отправки письма")
    }
  }

  const handleReject = async (emailId: number) => {
    try {
      const response = await fetch("/api/reservations/emails/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      })

      if (!response.ok) {
        throw new Error("Не вышло отклонить запись")
      }

      try {
        const smtpResponse = await fetch("/api/reservations/emails/SMTP", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: emailId, type: "rejected" }),
        })

        if (smtpResponse.ok) {
          toast.success("Запись отклонена и письмо отправлено клиенту")
        } else {
          toast.warning("Запись отклонена, но не удалось отправить письмо клиенту")
        }
      } catch (smtpError) {
        console.error("SMTP Error:", smtpError)
        toast.warning("Запись отклонена, но не удалось отправить письмо клиенту")
      }

      await fetchEmailReservations()
    } catch (error) {
      console.error("Error rejecting reservation:", error)
      toast.error("Не вышло отклонить запись")
    }
  }

  const handleUndo = async (emailId: number) => {
    try {
      const response = await fetch("/api/reservations/emails/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      })

      if (!response.ok) {
        throw new Error("Не вышло отменить отклонение")
      }

      try {
        const smtpResponse = await fetch("/api/reservations/emails/SMTP", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: emailId, type: "undo" }),
        })

        if (smtpResponse.ok) {
          toast.success("Отклонение отменено - запись подтверждена и письмо отправлено клиенту")
        } else {
          toast.warning("Отклонение отменено, но не удалось отправить письмо клиенту")
        }
      } catch (smtpError) {
        console.error("SMTP Error:", smtpError)
        toast.warning("Отклонение отменено, но не удалось отправить письмо клиенту")
      }

      await fetchEmailReservations()
    } catch (error) {
      console.error("Error undoing rejection:", error)
      toast.error("Не вышло отменить отклонение")
    }
  }

  const handleNameClick = (reservation: EmailReservation): void => {
    setSelectedReservation(reservation)
    setIsModalOpen(true)
  }

  const handleStrike = async (email: string) => {
    try {
      const response = await fetch("/api/reservations/emails/strikes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: "increment" }),
      })
      if (!response.ok) throw new Error("Failed to add strike")
      const data = await response.json()
      toast.success(`Страйк добавлен (${data.strikes})`)
      await fetchEmailReservations()
    } catch (error) {
      console.error("Strike error:", error)
      toast.error("Не удалось добавить страйк")
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Загрузка...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const pendingReservations = emailReservations.filter((r) => r.status === "pending")
  const processedReservations = emailReservations.filter((r) => r.status !== "pending")

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push("/reservations")}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:bg-gray-500 bg-transparent"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к расписанию
            </Button>
          </div>

          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="border-gray-600 text-white hover:bg-gray-700 bg-transparent"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>


        {/* Email Reservations List */}
        <div className="space-y-6">
          {/* Pending Reservations */}
          {pendingReservations.length > 0 && (
            <div>
              <div className="space-y-4">
                {pendingReservations.map((reservation) => (
                  <EmailReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onConfirm={handleConfirm}
                    onConfirmSilent={handleConfirmSilent}
                    onReject={handleReject}
                    onUndo={handleUndo}
                    onNameClick={handleNameClick}
                    onStrike={handleStrike}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Processed Reservations */}
          {processedReservations.length > 0 && (
            <div>
              <div className="space-y-4">
                {processedReservations.map((reservation) => (
                  <EmailReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onConfirm={handleConfirm}
                    onConfirmSilent={handleConfirmSilent}
                    onReject={handleReject}
                    onUndo={handleUndo}
                    onNameClick={handleNameClick}
                    onStrike={handleStrike}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {emailReservations.length === 0 && (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No email reservations</h3>
              <p className="text-gray-500">Email reservation requests will appear here</p>
            </div>
          )}
        </div>
      </div>
      <ReservationModal reservation={selectedReservation} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  )
}
