"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, RefreshCw } from "lucide-react"
import { EmailReservationCard } from "@/components/email-reservation-card"
import { useToast } from "@/hooks/use-toast"
import { EmailReservation } from "@/types/email-reservations"

export default function EmailReservationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [emailReservations, setEmailReservations] = useState<EmailReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (status === "loading") return

    if (!session) {
      router.push("/login")
      return
    }
  }, [session, status, router, toast])

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
      toast({
        title: "Error",
        description: "Не вышло загрузить email-записи",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    if (session) {
      fetchEmailReservations()
    }
  }, [session, fetchEmailReservations])

  const handleRefresh = async () => {
    setRefreshing(true)
    
    try {
      // Шаг 1: Получаем новые письма через IMAP
      console.log('📡 Fetching emails from IMAP...')
      const imapResponse = await fetch('/api/reservations/emails/IMAP')
      
      if (!imapResponse.ok) {
        throw new Error(`IMAP fetch failed: ${imapResponse.statusText}`)
      }
      
      const imapData = await imapResponse.json()
      console.log(`📬 Found ${imapData.emailsFound} new emails`)
      
      if (imapData.emailsFound === 0) {
        toast({
          title: "Информация",
          description: "Новых писем не найдено",
        })
        await fetchEmailReservations()
        return
      }
      
      // Шаг 2: Импортируем найденные письма в базу данных
      console.log('💾 Importing emails to database...')
      const dbResponse = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: imapData.emails }),
      })
      
      if (!dbResponse.ok) {
        throw new Error(`Database import failed: ${dbResponse.statusText}`)
      }
      
      const dbData = await dbResponse.json()
      console.log(`📊 Import result: ${dbData.processedCount}/${dbData.totalEmails} processed`)
      
      // Шаг 3: Показываем результат пользователю
      if (dbData.success) {
        toast({
          title: "Успех",
          description: `Обработано ${dbData.processedCount} новых резерваций`,
        })
      } else {
        toast({
          title: "Частичный успех",
          description: `Обработано ${dbData.processedCount} из ${dbData.totalEmails}. Ошибок: ${dbData.errorCount}`,
          variant: "destructive",
        })
      }
      
      // Шаг 4: Обновляем список резерваций
      await fetchEmailReservations()
      
    } catch (error) {
      console.error('❌ Refresh error:', error)
      toast({
        title: "Ошибка",
        description: `Не удалось обновить резервации: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
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

      if (response.ok) {
        toast({
          title: "Success",
          description: "Запись подтверждена",
        })
        await fetchEmailReservations()
      } else {
        throw new Error("Не вышло подтвердить запись")
      }
    } catch (error) {
      console.error("Error confirming reservation:", error)
      toast({
        title: "Error",
        description: "Не вышло подтвердить запись",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (emailId: number) => {
    try {
      const response = await fetch("/api/reservations/emails/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Запись отклонена",
        })
        await fetchEmailReservations()
      } else {
        throw new Error("Не вышло отклонить запись")
      }
    } catch (error) {
      console.error("Error rejecting reservation:", error)
      toast({
        title: "Error",
        description: "Не вышло отклонить запись",
        variant: "destructive",
      })
    }
  }

  const handleUndo = async (emailId: number) => {
    try {
      const response = await fetch("/api/reservations/emails/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Отклонение отменено - запись подтверждена",
        })
        await fetchEmailReservations()
      } else {
        throw new Error("Не вышло отменить отклонение")
      }
    } catch (error) {
      console.error("Error undoing rejection:", error)
      toast({
        title: "Error",
        description: "Failed to undo rejection",
        variant: "destructive",
      })
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
            {/* <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold">Email Reservations</h1>
                <p className="text-gray-400">Manage incoming reservation requests</p>
              </div>
            </div> */}
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

        {/* Stats */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Pending Requests</p>
            <p className="text-2xl font-bold text-yellow-400">{pendingReservations.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Confirmed</p>
            <p className="text-2xl font-bold text-green-400">
              {emailReservations.filter((r) => r.status === "confirmed").length}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Rejected</p>
            <p className="text-2xl font-bold text-red-400">
              {emailReservations.filter((r) => r.status === "rejected").length}
            </p>
          </div>
        </div> */}

        {/* Email Reservations List */}
        <div className="space-y-6">
          {/* Pending Reservations */}
          {pendingReservations.length > 0 && (
            <div>
              {/* <h2 className="text-lg font-semibold mb-4 text-yellow-400">
                Pending Requests ({pendingReservations.length})
              </h2> */}
              <div className="space-y-4">
                {pendingReservations.map((reservation) => (
                  <EmailReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onConfirm={handleConfirm}
                    onReject={handleReject}
                    onUndo={handleUndo}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Processed Reservations */}
          {processedReservations.length > 0 && (
            <div>
              {/* <h2 className="text-lg font-semibold mb-4 text-gray-400">
                Processed Requests ({processedReservations.length})
              </h2> */}
              <div className="space-y-4">
                {processedReservations.map((reservation) => (
                  <EmailReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onConfirm={handleConfirm}
                    onReject={handleReject}
                    onUndo={handleUndo}
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
    </div>
  )
}
