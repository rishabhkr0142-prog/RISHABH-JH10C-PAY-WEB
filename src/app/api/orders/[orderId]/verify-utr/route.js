import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { rateLimit } from "@/lib/rate-limit";
import { toPlainText } from "@/lib/serialize";
import { incrementStat } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:orderId/verify-utr
 * Buyer submits their 12-digit UPI UTR to instantly claim an unclaimed incoming payment.
 */
export async function POST(request, { params }) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be logged in to verify payment." },
      { status: 401 }
    );
  }

  // 1. Rate Limit: 5 attempts per minute per user ID
  const rl = rateLimit(`verify_utr_${session.user.id}`, 5, 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      {
        error:
          "Too many verification attempts. Please wait 1 minute before trying again.",
      },
      { status: 429 }
    );
  }

  const orderId = params?.orderId || params?.id;
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

    // 2. Ownership verification (Order owner or Admin)
    const isOwner =
      order.userId === session.user.id ||
      order.discordId === session.user.id ||
      (userDoc?._id && String(order.user) === String(userDoc._id)) ||
      (session.user.email && order.email === session.user.email);

    const isAdmin = Boolean(session.user.isAdmin);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to verify this order." },
        { status: 403 }
      );
    }

    // If order is already paid, return success immediately
    if (order.status === "paid" || order.status === "completed") {
      return NextResponse.json({
        ok: true,
        message: "Payment already verified successfully.",
        order: toPlainText(order),
      });
    }

    // If order was cancelled
    if (order.status === "cancelled") {
      return NextResponse.json(
        { error: "This order has been cancelled and cannot be verified." },
        { status: 400 }
      );
    }

    // 3. Parse and Validate 12-Digit UTR
    const body = await request.json().catch(() => ({}));
    const rawUtr = String(body.utr || "").trim();
    const cleanUtr = rawUtr.replace(/[\s-]/g, "");

    if (!/^\d{12}$/.test(cleanUtr)) {
      return NextResponse.json(
        { error: "UTR must be exactly 12 numeric digits." },
        { status: 400 }
      );
    }

    // Save submitted UTR on the order for reference
    order.utr = cleanUtr;
    await order.save();

    // 4. Find matching payment in database
    // Must match the exact clean 12-digit UTR and status 'unclaimed'
    const payment = await Payment.findOne({
      utr: cleanUtr,
      status: "unclaimed",
    });

    if (!payment) {
      // Check if this payment was already claimed
      const existingPayment = await Payment.findOne({ utr: cleanUtr });
      if (existingPayment) {
        if (
          existingPayment.orderId &&
          String(existingPayment.orderId) === String(order._id)
        ) {
          return NextResponse.json({
            ok: true,
            message: "Payment verified successfully",
            order: toPlainText(order),
          });
        }
        return NextResponse.json(
          {
            error:
              "This UPI UTR has already been claimed for another order. Please contact support if you believe this is an error.",
          },
          { status: 400 }
        );
      }

      // Check if order has expired
      const now = new Date();
      const isPastExpiry =
        order.status === "expired" ||
        (order.status === "pending" &&
          order.expiresAt &&
          new Date(order.expiresAt) <= now);

      if (isPastExpiry) {
        if (order.status !== "expired") {
          await Order.findByIdAndUpdate(order._id, { status: "expired" });
        }
        return NextResponse.json(
          {
            error:
              "This order has expired and no matching payment was received for this UTR. If you completed payment, please contact support.",
          },
          { status: 400 }
        );
      }

      // Not found in DB yet -> FamPay alert email may still be in transit
      return NextResponse.json(
        {
          error:
            "Payment not received yet. If you just paid, wait 30-60 seconds for the email to arrive and retry.",
        },
        { status: 404 }
      );
    }

    // 5. Verify payment.amountPaise matches order.amountPaise
    const orderPaise =
      order.amountPaise || Math.round((Number(order.price) || 0) * 100);

    if (payment.amountPaise !== orderPaise) {
      const receivedRupees = (payment.amountPaise / 100).toFixed(2);
      const expectedRupees = (orderPaise / 100).toFixed(2);
      return NextResponse.json(
        {
          error: `Amount mismatch: Payment received is ₹${receivedRupees}, but order total is ₹${expectedRupees}.`,
        },
        { status: 400 }
      );
    }

    // 6. Verify payment window (createdAt <= payment.paidAt <= expiresAt + grace buffer)
    const paidAtMs = new Date(payment.paidAt).getTime();
    const createdAtMs = new Date(order.createdAt).getTime() - 120000; // 2-minute buffer for clock differences
    const expiresAtMs = new Date(order.expiresAt).getTime() + 15 * 60000; // 15-minute buffer for transit latency

    if (paidAtMs < createdAtMs || paidAtMs > expiresAtMs) {
      return NextResponse.json(
        {
          error:
            "Payment timestamp does not match the valid order time window.",
        },
        { status: 400 }
      );
    }

    // 7. Atomically link order and payment
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
        {
          error:
            "Payment was already claimed by another session. Please refresh.",
        },
        { status: 409 }
      );
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: { $in: ["pending", "expired"] } },
      {
        $set: {
          status: "paid",
          paidAt: payment.paidAt,
          utr: cleanUtr,
          paymentId: payment._id,
        },
      },
      { new: true }
    );

    if (!updatedOrder) {
      // Rollback payment claim
      await Payment.findByIdAndUpdate(payment._id, {
        $set: { status: "unclaimed", orderId: null },
      });
      return NextResponse.json(
        { error: "Could not mark order as paid. Please try again." },
        { status: 500 }
      );
    }

    // Update user client role & stats
    try {
      if (order.discordId) {
        await User.findOneAndUpdate(
          { discordId: order.discordId },
          { $set: { role: "client" }, $inc: { orderCount: 1, totalSpent: updatedOrder.price || 0 } }
        );
      }
      await incrementStat("revenue", updatedOrder.price || 0);
    } catch (metricErr) {
      console.error("Metric update error:", metricErr);
    }

    revalidatePath(`/checkout/${order._id}`);
    revalidatePath("/dashboard");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      message: "Payment verified successfully",
      order: toPlainText(updatedOrder),
    });
  } catch (err) {
    console.error("POST /api/orders/[orderId]/verify-utr failed:", err);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
