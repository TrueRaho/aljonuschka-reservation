import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  // Redirect based on role
  if (session.user.role === "admin") {
    redirect("/admin-only")
  } else if (session.user.role === "staff") {
    redirect("/reservations")
  }

  // Fallback redirect
  redirect("/login")
}
