import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Payment from "@/models/Payment";
import { recordPaymentLogs } from "@/lib/payment-audit";
import { rateLimit } from "@/lib/rate-limit";
import { toPlainText } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/payments/:paymentId
 * Soft-deletes a single unclaimed payment. The UTR row is kept forever so a
 * duplicate webhook cannot create a new unclaimed record for it.
 */
export async function DELETE(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  const rl = rateLimit(`payment_delete_${session.user.id}`, 30, 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many delete requests. Please wait a minute and try again." },
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
    const reason = String(body?.reason || "").trim().slice(0, 500);

    const payment = await Payment.findById(paymentId)
      .select("_id utr amountPaise status archived")
      .lean();

    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    if (payment.status !== "unclaimed" || payment.archived) {
      return NextResponse.json(
        {
          error:
            "Only unclaimed payments can be deleted. This payment is already matched, deleted or used.",
        },
        { status: 409 }
      );
    }

    const now = new Date();

    // Atomic: the status guard prevents a concurrent match + delete race.
    const result = await Payment.updateOne(
      { _id: payment._id, status: "unclaimed" },
      {
        $set: {
          status: "deleted",
          archived: true,
          deletedAt: now,
          deletedBy: String(session.user.id || ""),
          deleteReason: reason,
        },
      }
    );

    if (result.modifiedCount !== 1) {
      return NextResponse.json(
        {
          error:
            "This payment changed state before it could be deleted (it may have just been matched).",
        },
        { status: 409 }
      );
    }

    await recordPaymentLogs("delete", [payment], session, reason);

    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      deletedIds: [String(payment._id)],
      payment: toPlainText({
        ...payment,
        status: "deleted",
        archived: true,
        deletedAt: now,
        deletedBy: String(session.user.id || ""),
        deleteReason: reason,
      }),
    });
  } catch (err) {
    console.error("DELETE /api/admin/payments/[paymentId] failed:", err);
    return NextResponse.json(
      { error: "Failed to delete payment." },
      { status: 500 }
    );
  }
}
