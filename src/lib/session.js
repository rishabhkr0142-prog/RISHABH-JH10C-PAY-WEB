import { getServerSession } from "next-auth/next";
import { authOptions, isUserAdmin } from "@/lib/auth";

/**
 * Server-side session helpers.
 */

/** Get the current session in Server Components / Route Handlers. */
export async function getSession() {
  return getServerSession(authOptions);
}

/** Convenience: true when the current visitor is the admin (owner). */
export async function isAdminSession() {
  const session = await getSession();
  return session ? isUserAdmin(session) : false;
}
