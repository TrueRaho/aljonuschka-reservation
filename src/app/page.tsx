"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export default function HomePage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === "loading") return

    if (session) {
      // Пользователь авторизован, перенаправляем в зависимости от роли
      if (session.user?.role === "admin") {
        router.push("/admin-only")
      } else if (session.user?.role === "staff") {
        router.push("/reservations")
      }
    } else {
      // Пользователь не авторизован, перенаправляем на страницу входа
      router.push("/login")
    }
  }, [session, status, router])

  // Отображаем экран загрузки, пока происходит перенаправление
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white text-xl">Загрузка...</div>
    </div>
  )
}
