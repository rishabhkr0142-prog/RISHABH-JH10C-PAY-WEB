import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { listResellers, searchUsers } from "@/lib/reseller-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/resellers?q=&page=&limit=
 * GET /api/admin/resellers?scope=all&q=... — search every user (make reseller).
 */
export async function GET(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const scope = url.searchParams.get("scope") === "all" ? "all" : "resellers";

    if (scope === "all") {
      const users = await searchUsers({
        q,
        limit: Number(url.searchParams.get("limit")) || 20,
      });
      return NextResponse.json({ ok: true, users });
    }

    const result = await listResellers({
      q,
      page: Number(url.searchParams.get("page")) || 1,
      limit: Number(url.searchParams.get("limit")) || 50,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("GET /api/admin/resellers failed:", err);
    return NextResponse.json(
      { error: "Could not load resellers." },
      { status: 500 }
    );
  }
}
