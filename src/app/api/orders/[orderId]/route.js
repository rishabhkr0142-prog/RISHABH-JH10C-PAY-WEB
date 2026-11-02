import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { findUserForSession } from "@/lib/account";
import { toPlainText } from "@/lib/serialize";
import { isOrderOwner, redactOrderLicense } from "@/lib/order-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/:orderId
 * Fetches single order status. Auto-expires if payment window elapsed.
 */
export async function GET(request, { params }) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = params || {};
  if (!orderId || !/^[a-f\d]{24}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    await connectDB();
    const userDoc = await findUserForSession(session);
    const userDocLean = userDoc?.toObject ? userDoc.toObject() : userDoc;

    const order = await Order.findById(orderId).populate("product").lean();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isOwner = isOrderOwner(order, session, userDocLean);

    const isAdmin = Boolean(session.user.isAdmin);

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Server-side auto-expiration check
    const now = new Date();
    if (order.status === "pending" && order.expiresAt && new Date(order.expiresAt) <= now) {
      await Order.findByIdAndUpdate(orderId, { status: "expired" });
      order.status = "expired";
    }

    return NextResponse.json({
      ok: true,
      order: redactOrderLicense(toPlainText(order), session, userDocLean),
    });
  } catch (err) {
    console.error("GET /api/orders/[orderId] failed:", err);
    return NextResponse.json({ error: "Failed to fetch order status" }, { status: 500 });
  }
}

