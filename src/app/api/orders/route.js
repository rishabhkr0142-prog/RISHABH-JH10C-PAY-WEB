import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Order from "@/models/Order";
import User from "@/models/User";
import { incrementStat } from "@/lib/stats";
import { toPlainText } from "@/lib/serialize";
import { getSetting } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders — Authenticated user creates a new order in pending status.
 * Enforces 10-minute cooldown between orders (admin is exempt).
 */
export async function POST(request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in with Discord to place an order." },
      { status: 401 }
    );
  }

  // Rate limit: 12 order requests per minute per user ID
  const rl = rateLimit(`order_post_${session.user.id}`, 12, 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many order attempts. Please slow down." },
      { status: 429 }
    );
  }

  try {
    await connectDB();
    const body = await request.json();
    const { productId, quantity = 1, notes = "", planLabel, planDays } = body || {};

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required." },
        { status: 400 }
      );
    }

    // 1. Fetch product
    const product = await Product.findById(productId);
    if (!product || product.active === false || product.available === false) {
      return NextResponse.json(
        { error: "Product is not available for purchase." },
        { status: 404 }
      );
    }

    if (product.stock !== undefined && product.stock <= 0) {
      return NextResponse.json(
        { error: "Product is currently out of stock." },
        { status: 400 }
      );
    }

    // 2. Fetch or create user in MongoDB
    let userDoc = await User.findOne({ discordId: session.user.id });
    if (!userDoc) {
      userDoc = await User.create({
        discordId: session.user.id,
        username: session.user.name || session.user.id,
        avatar: session.user.image || "",
        email: session.user.email || "",
      });
      await incrementStat("users");
    }

    // 3. Server-Side Price & Duration Plan Verification
    const qty = Math.max(1, Number(quantity) || 1);
    let unitPrice = Number(product.price) || 0;
    let selectedPlanData = null;

    if (Array.isArray(product.plans) && product.plans.length > 0) {
      let matchedPlan = null;
      if (planLabel) {
        matchedPlan = product.plans.find(
          (p) =>
            String(p.label).trim().toLowerCase() === String(planLabel).trim().toLowerCase()
        );
      }
      if (!matchedPlan && planDays !== undefined) {
        matchedPlan = product.plans.find((p) => Number(p.days) === Number(planDays));
      }
      // If client didn't match or didn't supply plan, default to lowest price plan
      if (!matchedPlan) {
        matchedPlan = product.plans.reduce(
          (min, p) => (Number(p.price) < Number(min.price) ? p : min),
          product.plans[0]
        );
      }

      unitPrice = Number(matchedPlan.price);
      selectedPlanData = {
        label:
          matchedPlan.label ||
          (matchedPlan.days === 0 ? "Lifetime" : `${matchedPlan.days} Days`),
        days: Number(matchedPlan.days) || 0,
        price: unitPrice,
      };
    }

    const totalPrice = unitPrice * qty;

    // 4. Reuse Existing Unexpired Pending Order for the same Product & Plan
    const now = new Date();
    const reuseFilter = {
      $or: [
        { discordId: session.user.id },
        ...(userDoc?._id ? [{ user: userDoc._id }] : []),
      ],
      product: product._id,
      status: "pending",
      expiresAt: { $gt: now },
    };

    if (selectedPlanData?.label) {
      reuseFilter["plan.label"] = selectedPlanData.label;
    }

    const existingPendingOrder = await Order.findOne(reuseFilter).sort({ createdAt: -1 });

    if (existingPendingOrder) {
      return NextResponse.json({
        ok: true,
        reused: true,
        orderId: String(existingPendingOrder._id),
        checkoutUrl: `/checkout/${existingPendingOrder._id}`,
        order: toPlainText(existingPendingOrder),
      });
    }

    // 5. Enforce 10-minute anti-spam cooldown for NEW orders (Admin is exempt)
    const isAdmin = Boolean(session.user.isAdmin);
    if (!isAdmin) {
      const cooldownMinutesSetting = await getSetting(
        "order_cooldown_minutes",
        process.env.ORDER_COOLDOWN_MINUTES || 10
      );
      const cooldownMinutes = Math.max(1, Number(cooldownMinutesSetting) || 10);
      const cooldownMs = cooldownMinutes * 60 * 1000;

      const latestOrder = await Order.findOne({
        $or: [
          { discordId: session.user.id },
          ...(userDoc?._id ? [{ user: userDoc._id }] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .lean();

      if (latestOrder) {
        const elapsedMs = Date.now() - new Date(latestOrder.createdAt).getTime();
        if (elapsedMs < cooldownMs) {
          const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
          const mins = Math.floor(remainingSeconds / 60);
          const secs = remainingSeconds % 60;
          const formattedTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

          return NextResponse.json(
            {
              error: `Order cooldown active. You can place another order in ${formattedTime}.`,
              remainingSeconds,
            },
            { status: 429 }
          );
        }
      }
    }

    // 6. Create the pending order with a 10-minute payment timer
    const order = await Order.create({
      user: userDoc._id,
      product: product._id,
      price: totalPrice,
      amount: totalPrice,
      status: "pending",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      productName: product.name,
      customerName: session.user.name || userDoc.username || "Discord User",
      email: session.user.email || userDoc.email || "",
      discordId: session.user.id,
      quantity: qty,
      notes: String(notes || "").trim(),
      ...(selectedPlanData ? { plan: selectedPlanData } : {}),
    });

    // 7. Update global store counters
    await incrementStat("orders");

    revalidatePath("/dashboard");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      orderId: String(order._id),
      checkoutUrl: `/checkout/${order._id}`,
      order: toPlainText(order),
    });
  } catch (err) {
    console.error("POST /api/orders failed:", err);
    return NextResponse.json(
      { error: "Failed to place order. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders — Fetch orders belonging to the logged-in user.
 */
export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const userDoc = await User.findOne({ discordId: session.user.id }).lean();

    const query = {
      $or: [
        { discordId: session.user.id },
        ...(userDoc?._id ? [{ user: userDoc._id }] : []),
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    };

    const orders = await Order.find(query)
      .populate("product")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ ok: true, orders: toPlainText(orders) });
  } catch (err) {
    console.error("GET /api/orders failed:", err);
    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 }
    );
  }
}
