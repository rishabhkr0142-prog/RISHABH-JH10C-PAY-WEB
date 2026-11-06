import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { findUserForSession } from "@/lib/account";
import { toPlainText } from "@/lib/serialize";
import { ownerFilterFor, redactOrderLicense } from "@/lib/order-access";
import { rateLimit } from "@/lib/rate-limit";
import { createOrder } from "@/lib/order-create";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders — Authenticated user creates a new order in pending status.
 * Enforces 10-minute cooldown between orders (admin is exempt).
 *
 * Clients should send an `Idempotency-Key` header (UUID per checkout attempt).
 * Duplicate completed keys replay the saved response; duplicate in-flight
 * keys get a 409.
 */
export async function POST(request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to place an order." },
      { status: 401 }
    );
  }

  // Rate limit: 12 order requests per minute per user ID
  const rl = rateLimit(`order_post_${session.user.id}`, 12, 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many order attempts. Please slow down." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const idempotencyKey = String(
    request.headers.get("idempotency-key") || ""
  ).trim();

  const result = await createOrder({
    session,
    body,
    idempotencyKey,
    endpoint: "POST /api/orders",
  });

  if (result.status < 400) {
    revalidatePath("/dashboard");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
  }

  return NextResponse.json(result.body, { status: result.status });
}

/**
 * GET /api/orders — Fetch orders belonging to the logged-in user.
 */
export async function GET(request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const userDoc = await findUserForSession(session);
    const userDocLean = userDoc?.toObject ? userDoc.toObject() : userDoc;

    // Hard cap: never return an unbounded order list.
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
      : 100;

    const orders = await Order.find(ownerFilterFor(session, userDocLean))
      .populate("product")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const safeOrders = toPlainText(orders).map((order) =>
      redactOrderLicense(order, session, userDocLean)
    );

    return NextResponse.json({ ok: true, orders: safeOrders });
  } catch (err) {
    console.error("GET /api/orders failed:", err);
    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 }
    );
  }
}
