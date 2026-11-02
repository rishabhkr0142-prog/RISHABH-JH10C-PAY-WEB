import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { isRealDiscordId, linkedDiscordId } from "@/lib/account";
import { isContentDelivery } from "@/lib/delivery-content";
import { sendOrderDM } from "@/lib/discord";

export const dynamic = "force-dynamic";

const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * POST /api/admin/orders/:id/resend-dm
 * Admin-only DM resend for a completed license or content order.
 */
export async function POST(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const id = params?.id;
  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
  }

  try {
    await connectDB();

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const hasDelivery = isContentDelivery(order.deliveryType)
      ? Boolean(order.deliveryContent)
      : Boolean(order.licenseKey);

    if (order.status !== "completed" || !hasDelivery) {
      return NextResponse.json(
        { error: "This order does not have delivery details to resend yet." },
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

    const buyer = order.user ? await User.findById(order.user).lean() : null;

    const discordId =
      (isRealDiscordId(order.discordId) ? String(order.discordId).trim() : "") ||
      linkedDiscordId(buyer) ||
      (isRealDiscordId(order.userId) ? String(order.userId).trim() : "");

    if (!discordId) {
      return NextResponse.json(
        {
          error: "Discord is not linked to this buyer.",
          code: "discord_not_linked",
        },
        { status: 400 }
      );
    }

    try {
      await sendOrderDM({ discordId, order: order.toObject() });

      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            discordId,
            dmSent: true,
            dmError: "",
            dmSkipReason: "",
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
            dmSkipReason: "",
            dmLastResentAt: new Date(),
          },
        }
      );

      return NextResponse.json(
        {
          error:
            "Could not send the DM. Make sure the buyer's Discord DMs are open, then try again later.",
        },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error(
      "POST /api/admin/orders/[id]/resend-dm failed:",
      err?.message || err
    );
    return NextResponse.json(
      { error: "Could not resend the DM. Please try again." },
      { status: 500 }
    );
  }
}
