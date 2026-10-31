import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { toPlainText } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:orderId/utr
 * Submits the 12-digit UPI UTR / Transaction Reference ID.
 */
export async function POST(request, { params }) {
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
    const userDoc = await User.findOne({ discordId: session.user.id }).lean();

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const isOwner =
      order.discordId === session.user.id ||
      (userDoc?._id && String(order.user) === String(userDoc._id)) ||
      (session.user.email && order.email === session.user.email);

    const isAdmin = Boolean(session.user.isAdmin);

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify order is not expired
    const now = new Date();
    if (order.status === "expired" || (order.status === "pending" && order.expiresAt && new Date(order.expiresAt) <= now)) {
      if (order.status !== "expired") {
        order.status = "expired";
        await order.save();
      }
      return NextResponse.json(
        { error: "This order has expired. Please create a new order." },
        { status: 400 }
      );
    }

    if (order.status === "cancelled") {
      return NextResponse.json(
        { error: "This order has been cancelled and cannot be paid." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawUtr = String(body.utr || "").trim();
    // Remove any spaces or hyphens users might enter
    const cleanUtr = rawUtr.replace(/[\s-]/g, "");

    // Must be exactly 12 digits
    if (!/^\d{12}$/.test(cleanUtr)) {
      return NextResponse.json(
        { error: "UTR / Transaction ID must be exactly 12 numeric digits." },
        { status: 400 }
      );
    }

    order.utr = cleanUtr;
    await order.save();

    revalidatePath(`/checkout/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/dashboard");

    return NextResponse.json({
      ok: true,
      utr: cleanUtr,
      order: toPlainText(order),
    });
  } catch (err) {
    console.error("POST /api/orders/[orderId]/utr failed:", err);
    return NextResponse.json({ error: "Failed to record UTR" }, { status: 500 });
  }
}

