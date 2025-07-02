import { DefaultSession } from "next-auth";

// Declare available user roles
export type UserRole = "admin" | "staff";

// ===============================
// Module augmentation for NextAuth
// ===============================

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
  }
}
