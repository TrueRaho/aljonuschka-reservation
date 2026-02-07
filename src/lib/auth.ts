import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { getAllPasswordRecords } from "@/services/authService"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.password) {
          return null
        }

        try {
          // Get all password hashes from database
          const passwordRecords = await getAllPasswordRecords()

          // Check password against each role
          for (const record of passwordRecords) {
            const isValid = await bcrypt.compare(credentials.password, record.passwordHash)
            if (isValid) {
              return {
                id: record.role,
                role: record.role as "admin" | "staff",
              }
            }
          }

          return null
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Handle role-based redirects after login
      if (url.includes("/api/auth/callback")) {
        return baseUrl + "/auth/redirect"
      }
      return url.startsWith(baseUrl) ? url : baseUrl
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
}
