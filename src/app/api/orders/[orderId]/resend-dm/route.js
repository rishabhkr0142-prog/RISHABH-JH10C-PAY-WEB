import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { isOrderOwner } from "@/lib/order-access";
import { sendLicenseDM } from "@/lib/discord";

export const dynamic = "force-dynamic";

const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * POST /api/orders/:orderId/resend-dm
 * Owner-only "Resend DM" for an already delivered order.
 * One resend per 5 minutes per order.
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

    const [order, userDoc] = await Promise.all([
      Order.findById(orderId),
      User.findOne({ discordId: session.user.id }).lean(),
    ]);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!isOrderOwner(order, session, userDoc)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (order.status !== "completed" || !order.licenseKey) {
      return NextResponse.json(
        { error: "This order does not have a license key to resend yet." },
        { status: 400 }
      );
    }

    const lastResent = order.dmLastResentAt
      ? new Date(order.dmLastResentAt).getTime()
      : 0;
    const elapsed = Date.now() - lastResent;

    if (lastResent && elapsed < RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json(
        {
          error: `Please wait ${Math.ceil(retryAfterSeconds / 60)} minute(s) before resending.`,
          retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const discordId = String(order.discordId || order.userId || "").trim();
    if (!discordId) {
      return NextResponse.json(
        { error: "No Discord ID is linked to this order." },
        { status: 400 }
      );
    }

    try {
      await sendLicenseDM({ discordId, order: order.toObject() });

      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            dmSent: true,
            dmError: "",
            dmSentAt: new Date(),
            dmLastResentAt: new Date(),
          },
        }
      );

      return NextResponse.json({ ok: true, dmSent: true });
    } catch (dmErr) {
      const message = String(dmErr?.message || "Discord DM failed").slice(0, 500);

      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            dmSent: false,
            dmError: message,
            dmLastResentAt: new Date(),
          },
        }
      );

      return NextResponse.json(
        {
          error:
            "Could not send the DM. Make sure your Discord DMs are open, then try again later.",
        },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error(
      "POST /api/orders/[orderId]/resend-dm failed:",
      err?.message || err
    );
    return NextResponse.json(
      { error: "Could not resend the DM. Please try again." },
      { status: 500 }
    );
  }
}
