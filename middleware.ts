import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // Add any additional middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname
        
        // Страница emails доступна только для пользователей с ролью staff
        if (pathname.startsWith("/reservations/emails")) {
          return token?.role === "staff"
        }
        
        // Другие маршруты в разделе reservations доступны любому авторизованному пользователю
        if (pathname.startsWith("/reservations")) {
          return token?.role === "staff"
        }
        
        // Admin-only маршруты
        if (pathname.startsWith("/admin-only")) {
          return token?.role === "admin"
        }
        
        return true
      },
    },
  },
)

export const config = {
  matcher: ["/reservations/:path*", "/admin-only/:path*"],
}
