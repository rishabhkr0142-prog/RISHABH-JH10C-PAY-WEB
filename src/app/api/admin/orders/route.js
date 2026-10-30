import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Order, { ORDER_STATUSES } from "@/models/Order";
import Product from "@/models/Product";
import { incrementStat } from "@/lib/stats";

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

    const quantity = Math.max(1, Number(body?.quantity || 1) || 1);
    const providedAmount = Number(body?.amount);
    const amount =
      Number.isFinite(providedAmount) && providedAmount > 0
        ? providedAmount
        : product.price * quantity;

    const status = ORDER_STATUSES.includes(body?.status)
      ? body.status
      : "pending";

    const { customerName, email, discordId, plan } = body || {};

    await Order.create({
      customerName: String(customerName || "Guest").trim(),
      email: String(email || "").trim(),
      discordId: String(discordId || "").trim(),
      product: productId,
      productName: product.name,
      quantity,
      price: amount,
      amount,
      status,
      ...(plan && typeof plan === "object" ? { plan } : {}),
    });

    await incrementStat("orders");
    revalidatePath("/admin/orders");
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/orders:", err);
    return NextResponse.json({ error: "Could not create order." }, { status: 500 });
  }
}
