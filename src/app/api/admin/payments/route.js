import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Payment from "@/models/Payment";
import { toPlainText } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments
 * Fetches all UPI payment webhook logs (Admin only).
 */
export async function GET(request) {
  const session = await getSession();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const query = {};
    if (status && ["unclaimed", "claimed"].includes(status)) {
      query.status = status;
    }

    const payments = await Payment.find(query)
      .populate("orderId")
      .sort({ receivedAt: -1 })
      .lean();

    return NextResponse.json({
      ok: true,
      payments: toPlainText(payments),
    });
  } catch (err) {
    console.error("GET /api/admin/payments failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}
