import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Payment from "@/models/Payment";
import { recordPaymentLogs } from "@/lib/payment-audit";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BULK = 50;

/**
 * POST /api/admin/payments/bulk-action
 * Body: { action: "delete" | "restore", ids: string[], reason?: string }
 *
 * Soft-deletes or restores up to 50 payments. Each row is updated with an
 * atomic status guard so a concurrent match cannot be overwritten.
 */
export async function POST(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  const rl = rateLimit(`payment_bulk_${session.user.id}`, 20, 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many bulk requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");
    if (!["delete", "restore"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'delete' or 'restore'." },
        { status: 400 }
      );
    }

    const rawIds = Array.isArray(body?.ids) ? body.ids : [];
    const ids = [
      ...new Set(
        rawIds
          .map((id) => String(id || "").trim())
          .filter((id) => /^[a-f\d]{24}$/i.test(id))
      ),
    ];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Select at least one valid payment." },
        { status: 400 }
      );
    }

    if (ids.length > MAX_BULK) {
      return NextResponse.json(
        { error: `You can only process ${MAX_BULK} payments at a time.` },
        { status: 400 }
      );
    }

    const defaultReason =
      action === "delete" ? "Bulk deleted from admin panel" : "Restored from admin panel";
    const reason = String(body?.reason || defaultReason).trim().slice(0, 500);

    await connectDB();

    const payments = await Payment.find({ _id: { $in: ids } })
      .select("_id utr amountPaise status archived")
      .lean();

    if (payments.length === 0) {
      return NextResponse.json(
        { error: "No matching payments found." },
        { status: 404 }
      );
    }

    const now = new Date();
    const adminId = String(session.user.id || "");
    const changed = [];
    const skipped = [];

    for (const payment of payments) {
      if (action === "delete") {
        if (payment.status !== "unclaimed" || payment.archived) {
          skipped.push(String(payment._id));
          continue;
        }

        const result = await Payment.updateOne(
          { _id: payment._id, status: "unclaimed" },
          {
            $set: {
              status: "deleted",
              archived: true,
              deletedAt: now,
              deletedBy: adminId,
              deleteReason: reason,
            },
          }
        );

        if (result.modifiedCount === 1) changed.push(payment);
        else skipped.push(String(payment._id));
      } else {
        if (payment.status !== "deleted") {
          skipped.push(String(payment._id));
          continue;
        }

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

        if (result.modifiedCount === 1) changed.push(payment);
        else skipped.push(String(payment._id));
      }
    }

    await recordPaymentLogs(action, changed, session, reason);

    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      action,
      deletedIds: action === "delete" ? changed.map((p) => String(p._id)) : [],
      restoredIds: action === "restore" ? changed.map((p) => String(p._id)) : [],
      skippedIds: skipped,
      changed: changed.length,
      skipped: skipped.length,
    });
  } catch (err) {
    console.error("POST /api/admin/payments/bulk-action failed:", err);
    return NextResponse.json(
      { error: "Failed to process selected payments." },
      { status: 500 }
    );
  }
}
