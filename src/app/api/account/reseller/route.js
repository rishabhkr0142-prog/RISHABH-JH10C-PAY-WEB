import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findUserForSession } from "@/lib/account";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/reseller — current account's reseller status.
 * Used by client components that must not be cached per-user (catalog etc).
 */
export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({
      ok: true,
      loggedIn: false,
      isReseller: false,
      resellerSince: null,
    });
  }

  try {
    const user = await findUserForSession(session);
    return NextResponse.json({
      ok: true,
      loggedIn: true,
      isReseller: Boolean(user?.isReseller),
      resellerSince: user?.resellerSince || null,
    });
  } catch (err) {
    console.error("GET /api/account/reseller failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load reseller status." },
      { status: 500 }
    );
  }
}
