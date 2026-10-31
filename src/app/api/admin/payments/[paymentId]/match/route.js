import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Payment from "@/models/Payment";
import Order from "@/models/Order";
import User from "@/models/User";
import { incrementStat } from "@/lib/stats";
import { toPlainText } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/payments/:paymentId/match
 * Allows store admin to manually link an unclaimed UPI payment to an Order.
 */
export async function POST(request, { params }) {
  const session = await getSession();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { paymentId } = params || {};
  if (!paymentId || !/^[a-f\d]{24}$/i.test(paymentId)) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const { orderId } = body || {};

    if (!orderId || !/^[a-f\d]{24}$/i.test(orderId)) {
      return NextResponse.json(
        { error: "Valid 24-character Order ID is required." },
        { status: 400 }
      );
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    if (payment.status === "claimed") {
      return NextResponse.json(
        { error: "This payment is already claimed by another order." },
        { status: 400 }
      );
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Atomically claim payment
    const claimedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "unclaimed" },
      {
        $set: {
          status: "claimed",
          orderId: order._id,
        },
      },
      { new: true }
    );

    if (!claimedPayment) {
      return NextResponse.json(
        { error: "Payment was claimed in a concurrent request." },
        { status: 409 }
      );
    }

    // Update order status to paid
    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      {
        $set: {
          status: "paid",
          paidAt: payment.paidAt || new Date(),
          utr: payment.utr,
          paymentId: payment._id,
        },
      },
      { new: true }
    );

    // Update user stats
    try {
      if (order.discordId) {
        await User.findOneAndUpdate(
          { discordId: order.discordId },
          { $set: { role: "client" }, $inc: { orderCount: 1, totalSpent: updatedOrder.price || 0 } }
        );
      }
      await incrementStat("revenue", updatedOrder.price || 0);
    } catch (statErr) {
      console.error("Metric increment failed:", statErr);
    }

    revalidatePath(`/checkout/${order._id}`);
    revalidatePath("/dashboard");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      message: `Payment #${payment.utr} successfully matched to Order #${String(order._id).slice(-8)}!`,
      order: toPlainText(updatedOrder),
      payment: toPlainText(claimedPayment),
    });
  } catch (err) {
    console.error("Manual payment match failed:", err);
    return NextResponse.json(
      { error: "Failed to match payment." },
      { status: 500 }
    );
  }
}
