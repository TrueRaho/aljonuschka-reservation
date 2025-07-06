"use client"

import type React from "react"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Проверяем пароль на пустоту
      if (!password.trim()) {
        setError("Введите пароль")
        setIsLoading(false)
        return
      }

      // Используем callbackUrl для редиректа после успешной авторизации
      // Это позволит NextAuth.js самостоятельно обработать сессию и редирект
      const result = await signIn("credentials", {
        password,
        callbackUrl: "/api/auth/redirect",
        redirect: false, // Отключаем автоматический редирект, чтобы обработать ошибки
      })
      
      // Проверяем результат
      if (result?.error) {
        // Если есть ошибка - показываем её
        setError("Неверный пароль. Попробуйте снова.")
        setIsLoading(false)
      } else if (result?.ok) {
        // Если авторизация успешна - перенаправляем на URL из callbackUrl
        console.log("Authentication successful, redirecting to", result.url)
        // Используем window.location вместо router.push для полной перезагрузки страницы с обновленной сессией
        window.location.href = result.url || "/api/auth/redirect"
      } else {
        // Неожиданный результат
        console.warn("Unexpected authentication result:", result)
        setError("An unexpected error occurred")
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Login error:", error)
      setError("An error occurred during sign in. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Aljonuschka</CardTitle>
          <CardDescription className="text-gray-400">
            Введите пароль для доступа к системе бронирования
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-800 rounded p-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-red-500 hover:bg-red-600 text-white"
              disabled={isLoading || !password}
            >
              {isLoading ? "Вход..." : "Войти"}
            </Button>
          </form>

          {/* <div className="mt-6 text-center text-xs text-gray-500">
            <p>Staff access: Use staff password</p>
            <p>Admin access: Use admin password</p>
          </div> */}
        </CardContent>
      </Card>
    </div>
  )
}
