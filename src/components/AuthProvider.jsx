"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Wraps the app with NextAuth's session context so client components
 * (Navbar user menu, Login page, ...) can call useSession().
 */
export default function AuthProvider({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
