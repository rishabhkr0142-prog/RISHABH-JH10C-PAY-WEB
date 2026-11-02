import { NextResponse } from "next/server";
import {
  getGoogleUsersStats,
  GOOGLE_USERS_REVALIDATE_SECONDS,
} from "@/lib/google-users";

// The data itself is cached for 5 minutes via unstable_cache. Keep the route
// dynamic so a privacy toggle can invalidate the cache tag immediately.
export const dynamic = "force-dynamic";

/**
 * GET /api/stats/google-users
 * Public, privacy-safe payload: { total, avatars }.
 */
export async function GET() {
  const data = await getGoogleUsersStats();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${GOOGLE_USERS_REVALIDATE_SECONDS}, stale-while-revalidate=600`,
    },
  });
}
