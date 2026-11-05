import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { releaseExpiredStockReservations } from "@/lib/product-stock";

export const dynamic = "force-dynamic";

async function runSweep(request) {
  const secret = process.env.STOCK_CRON_SECRET || process.env.CRON_SECRET;
  const url = new URL(request.url);
  const provided =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret") ||
    "";

  if (secret) {
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;
  }

  const released = await releaseExpiredStockReservations({ limit: 100 });
  return NextResponse.json({ ok: true, released });
}

export async function GET(request) {
  try {
    return await runSweep(request);
  } catch (err) {
    console.error("Stock cron sweep failed:", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    return await runSweep(request);
  } catch (err) {
    console.error("Stock cron sweep failed:", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
