import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Payment from "@/models/Payment";
import Order from "@/models/Order";
import { markOrderBuyerAsClient } from "@/lib/account";
import { toPlainText } from "@/lib/serialize";
import { completeOrder } from "@/lib/fulfillment";
import { ensureStockForPayment } from "@/lib/product-stock";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/payments/:paymentId/match
 * Allows store admin to manually link an unclaimed UPI payment to an Order.
 */
export async function POST(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

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

    if (payment.status === "deleted" || payment.archived) {
      return NextResponse.json(
        { error: "This payment was deleted and cannot be matched." },
        { status: 409 }
      );
    }

    if (payment.status !== "unclaimed") {
      return NextResponse.json(
        { error: "This payment is already claimed by another order." },
        { status: 400 }
      );
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Only unpaid orders may be matched — never re-pay a completed order.
    if (!["pending", "expired"].includes(order.status)) {
      return NextResponse.json(
        {
          error: `Order is "${order.status}" and cannot be matched to a new payment.`,
        },
        { status: 400 }
      );
    }

    // The received amount must match the order total exactly.
    const orderPaise =
      order.amountPaise || Math.round((Number(order.price) || 0) * 100);
    if (Number(payment.amountPaise) !== orderPaise) {
      return NextResponse.json(
        {
          error: `Amount mismatch: payment is ₹${(Number(payment.amountPaise) / 100).toFixed(
            2
          )}, but the order total is ₹${(orderPaise / 100).toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    // Confirm/re-acquire inventory before linking the payment.
    const stockCheck = await ensureStockForPayment(order);
    if (!stockCheck.ok) {
      return NextResponse.json(
        {
          error:
            stockCheck.reason === "out_of_stock"
              ? "This product is out of stock, so the order cannot be fulfilled. Restock it first."
              : "Inventory could not be reserved for this order.",
        },
        { status: 409 }
      );
    }

    // Atomically claim payment. The status guard makes this a single winner
    // even when two requests try to match the same UTR simultaneously.
    const claimResult = await Payment.updateOne(
      { _id: payment._id, status: "unclaimed" },
      {
        $set: {
          status: "matched",
          orderId: order._id,
        },
      }
    );

    if (claimResult.modifiedCount !== 1) {
      return NextResponse.json(
        { error: "Payment was matched in a concurrent request." },
        { status: 409 }
      );
    }

    const claimedPayment = {
      ...payment.toObject(),
      status: "matched",
      orderId: order._id,
    };

    // Update order status to paid only if it is still unpaid.
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: { $in: ["pending", "expired"] } },
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

    if (!updatedOrder) {
      await Payment.updateOne(
        { _id: payment._id, status: "matched", orderId: order._id },
        { $set: { status: "unclaimed", orderId: null } }
      );
      return NextResponse.json(
        { error: "Order was already paid by another request." },
        { status: 409 }
      );
    }

    // Update user stats
    try {
      await markOrderBuyerAsClient(updatedOrder);
    } catch (statErr) {
      console.error("Metric increment failed:", statErr);
    }

    // Automatic license delivery (idempotent, one key per order).
    let deliveredOrder = updatedOrder;
    try {
      const fulfillment = await completeOrder(updatedOrder._id);
      if (fulfillment?.order) deliveredOrder = fulfillment.order;
    } catch (fulfillmentErr) {
      console.error(
        "License fulfillment failed after manual payment match:",
        fulfillmentErr?.message || fulfillmentErr
      );
    }

    revalidatePath(`/checkout/${order._id}`);
    revalidatePath("/dashboard");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      message: `Payment #${payment.utr} successfully matched to Order #${String(order._id).slice(-8)}!`,
      order: toPlainText(deliveredOrder),
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
