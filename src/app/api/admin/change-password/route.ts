import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const session = await getServerSession(authOptions)
    
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Доступ запрещен. Требуются права администратора." },
        { status: 403 }
      )
    }

    // Получаем данные из запроса
    const { role, newPassword } = await request.json()
    
    // Проверяем валидность данных
    if (!role || !newPassword) {
      return NextResponse.json(
        { error: "Отсутствуют обязательные параметры" },
        { status: 400 }
      )
    }
    
    if (role !== "staff") {
      return NextResponse.json(
        { error: "Изменение пароля доступно только для роли staff" },
        { status: 400 }
      )
    }
    
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Пароль должен содержать не менее 8 символов" },
        { status: 400 }
      )
    }
    
    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    // Обновляем пароль в базе данных
    await sql`
      UPDATE auth_passwords 
      SET password_hash = ${hashedPassword} 
      WHERE role = ${role}
    `
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Ошибка при смене пароля:", error)
    return NextResponse.json(
      { error: "Произошла ошибка при смене пароля" },
      { status: 500 }
    )
  }
}
