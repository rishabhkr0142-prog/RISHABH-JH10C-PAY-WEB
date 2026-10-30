import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isUserAdmin } from "@/lib/auth";

/**
 * Guard for /api/admin/* route handlers.
 * Returns { session } when the caller is the owner (ADMIN_DISCORD_ID),
 * otherwise a ready-to-return NextResponse(401/403).
 *
 * Usage:
 *   const guard = await requireAdmin();
 *   if (guard instanceof NextResponse) return guard;
 *   const { session } = guard;
 */
export async function requireAdmin() {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be logged in to do that." },
      { status: 401 }
    );
  }

  if (!isUserAdmin(session)) {
    return NextResponse.json(
      { error: "Admin access denied." },
      { status: 403 }
    );
  }

  return { session };
}
