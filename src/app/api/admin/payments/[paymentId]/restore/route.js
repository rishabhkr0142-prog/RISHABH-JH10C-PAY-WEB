import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Payment from "@/models/Payment";
import { recordPaymentLogs } from "@/lib/payment-audit";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/payments/:paymentId/restore
 * Restores a soft-deleted payment back to the unclaimed pool.
 */
export async function POST(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  const rl = rateLimit(`payment_restore_${session.user.id}`, 30, 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many restore requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const { paymentId } = params || {};
  if (!paymentId || !/^[a-f\d]{24}$/i.test(paymentId)) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const reason =
      String(body?.reason || "Restored from admin panel").trim().slice(0, 500);

    const payment = await Payment.findById(paymentId)
      .select("_id utr amountPaise status archived")
      .lean();

    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    if (payment.status !== "deleted") {
      return NextResponse.json(
        { error: "Only deleted payments can be restored." },
        { status: 409 }
      );
    }

    // Atomic guard: only a currently deleted payment can become unclaimed.
    const result = await Payment.updateOne(
      { _id: payment._id, status: "deleted" },
      {
        $set: {
          status: "unclaimed",
          archived: false,
          deletedAt: null,
          deletedBy: "",
          deleteReason: "",
        },
      }
    );

    if (result.modifiedCount !== 1) {
      return NextResponse.json(
        { error: "This payment changed state before it could be restored." },
        { status: 409 }
      );
    }

    await recordPaymentLogs("restore", [payment], session, reason);

    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      restoredIds: [String(payment._id)],
      paymentId: String(payment._id),
    });
  } catch (err) {
    console.error("POST /api/admin/payments/[paymentId]/restore failed:", err);
    return NextResponse.json(
      { error: "Failed to restore payment." },
      { status: 500 }
    );
  }
}
