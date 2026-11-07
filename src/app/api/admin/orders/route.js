import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";
import { isRealDiscordId } from "@/lib/account";
import { incrementStat } from "@/lib/stats";
import { normalizeProductKey } from "@/lib/product-keys";
import { generateOrderNo } from "@/lib/order-number";
import {
  normalizeDeliveryType,
  resolveDeliveryContent,
} from "@/lib/delivery-content";
import { completeOrder } from "@/lib/fulfillment";

/**
 * POST /api/admin/orders — record an order manually (sales outside the site,
 * e.g. Discord DMs, go here). Body:
 *   { customerName, email?, discordId?, productId, quantity?, amount?, status }
 * Amount defaults to selected product price × quantity.
 * (Adds +1 to the "Total Orders" stat.)
 */
export async function POST(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const body = await request.json();

    const productId = String(body?.productId || "");
    if (!productId || !/^[a-f\d]{24}$/i.test(productId)) {
      return NextResponse.json({ error: "Select a valid product." }, { status: 400 });
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const deliveryType = normalizeDeliveryType(product.deliveryType);
    const productKey = normalizeProductKey(product.productKey);

    if (deliveryType === "license" && !productKey) {
      return NextResponse.json(
        { error: "Set this product's license app (uid/lib) in Products first." },
        { status: 400 }
      );
    }

    if (deliveryType === "content") {
      const resolved = resolveDeliveryContent(product, null, {
        productName: product.name,
      });
      if (!resolved.ok) {
        return NextResponse.json(
          {
            error:
              "Add delivery content (link or message) to this product first.",
          },
          { status: 400 }
        );
      }
    }

    const quantity = Math.max(1, Number(body?.quantity || 1) || 1);
    const providedAmount = Number(body?.amount);
    const amount =
      Number.isFinite(providedAmount) && providedAmount > 0
        ? providedAmount
        : product.price * quantity;

    // Manual records may only start as pending, paid, expired or cancelled.
    // "completed" is earned through the fulfillment pipeline, never set here.
    const CREATABLE_STATUSES = ["pending", "paid", "expired", "cancelled"];
    const status = CREATABLE_STATUSES.includes(body?.status)
      ? body.status
      : "pending";

    const { customerName, email, discordId, plan } = body || {};
    const cleanDiscordId = String(discordId || "").trim();

    // Link manually-recorded Discord orders to the matching site account so
    // they still appear in the buyer's dashboard.
    const buyer = isRealDiscordId(cleanDiscordId)
      ? await User.findOne({
          $or: [
            { discordId: cleanDiscordId },
            { "authProviders.discord.id": cleanDiscordId },
          ],
        }).lean()
      : null;

    const order = await Order.create({
      orderNo: generateOrderNo(),
      customerName: String(customerName || "Guest").trim(),
      email: String(email || "").trim(),
      userId: buyer ? String(buyer._id) : cleanDiscordId,
      ...(buyer ? { user: buyer._id } : {}),
      discordId: cleanDiscordId,
      product: productId,
      productId,
      productName: product.name,
      productKey,
      deliveryType,
      quantity,
      price: amount,
      amount,
      status,
      ...(plan && typeof plan === "object" ? { plan } : {}),
    });

    if (status === "paid") {
      try {
        await completeOrder(order._id);
      } catch (fulfillmentErr) {
        console.error(
          "Manual order license delivery failed:",
          fulfillmentErr?.message || fulfillmentErr
        );
      }
    }

    await incrementStat("orders");
    revalidatePath("/admin/orders");
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/orders:", err);
    return NextResponse.json({ error: "Could not create order." }, { status: 500 });
  }
}
