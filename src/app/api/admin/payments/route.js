import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Payment from "@/models/Payment";
import { toPlainText } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments
 * Fetches all UPI payment webhook logs (Admin only).
 */
export async function GET(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const requestedPage = Number(searchParams.get("page"));
    const requestedLimit = Number(searchParams.get("limit"));
    const page =
      Number.isFinite(requestedPage) && requestedPage >= 1
        ? Math.floor(requestedPage)
        : 1;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
      : 100;

    const query = {};
    if (
      status &&
      ["unclaimed", "matched", "claimed", "deleted"].includes(status)
    ) {
      query.status = status;
    }

    const total = await Payment.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);

    const payments = await Payment.find(query)
      .select(
        "utr txnId amountPaise payerUpi paidAt status archived deletedAt orderId receivedAt createdAt"
      )
      .sort({ receivedAt: -1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      payments: toPlainText(payments),
      pagination: { page: safePage, limit, total, totalPages },
    });
  } catch (err) {
    console.error("GET /api/admin/payments failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}
