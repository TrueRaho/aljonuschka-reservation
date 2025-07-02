import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // Add any additional middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Protect /reservations and /admin-only routes
        if (req.nextUrl.pathname.startsWith("/reservations")) {
          return !!token
        }
        if (req.nextUrl.pathname.startsWith("/admin-only")) {
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
