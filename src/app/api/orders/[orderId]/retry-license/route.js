import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { isLicenseOwner } from "@/lib/order-access";
import { rateLimit } from "@/lib/rate-limit";
import { retryOrderFulfillment } from "@/lib/fulfillment";
import { toPlainText } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const REASON_MESSAGES = {
  not_found: "Order not found.",
  not_paid: "Only paid orders can receive a license key.",
  processing: "Key generation is already in progress. Please wait a moment.",
  generation_failed: "License generation failed. Please retry in a minute.",
};

/**
 * POST /api/orders/:orderId/retry-license
 * Owner-only retry for a paid order whose key is missing/failed.
 * Rate-limited to prevent hammering the auth panel.
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

  const rl = rateLimit(`retry_license_${session.user.id}`, 3, 10 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  try {
    await connectDB();

    const order = await Order.findById(orderId).lean();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!isLicenseOwner(order, session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await retryOrderFulfillment(orderId);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: REASON_MESSAGES[result.reason] || "Could not generate license key.",
          reason: result.reason,
        },
        { status: result.reason === "processing" ? 409 : 400 }
      );
    }

    revalidatePath("/dashboard");
    revalidatePath(`/checkout/${orderId}`);
    revalidatePath("/admin/orders");

    return NextResponse.json({
      ok: true,
      alreadyCompleted: Boolean(result.alreadyCompleted),
      order: toPlainText(result.order),
    });
  } catch (err) {
    console.error(
      "POST /api/orders/[orderId]/retry-license failed:",
      err?.message || err
    );
    return NextResponse.json(
      { error: "License retry failed. Please try again." },
      { status: 500 }
    );
  }
}
