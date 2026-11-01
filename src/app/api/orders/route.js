import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Order from "@/models/Order";
import User from "@/models/User";
import { incrementStat } from "@/lib/stats";
import { toPlainText } from "@/lib/serialize";
import { ownerFilterFor, redactOrderLicense } from "@/lib/order-access";
import { getSetting } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { getCouponOffer } from "@/lib/offers";
import { calculateDiscount } from "@/lib/offer-utils";
import { normalizeProductKey } from "@/lib/product-keys";

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
    const { productId, planId, quantity = 1, notes = "", planLabel, planDays, couponCode } =
      body || {};

    if (!productId || !/^[a-f\d]{24}$/i.test(String(productId))) {
      return NextResponse.json(
        { error: "A valid product ID is required." },
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

    // The license app is always taken from the server-side product record,
    // never from the request body.
    const productKey = normalizeProductKey(product.productKey);
    if (!productKey) {
      return NextResponse.json(
        {
          error:
            "This product is not configured for automatic license delivery. Please contact support.",
        },
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

    // 3. Server-Side Price & Duration Plan Verification (Never trust client price)
    const qty = Math.max(1, Number(quantity) || 1);
    let unitPrice = Number(product.price) || 0;
    let selectedPlanData = null;
    let resolvedPlanId = planId ? String(planId).trim() : "";

    if (Array.isArray(product.plans) && product.plans.length > 0) {
      let matchedPlan = null;

      // Try matching by planId first (ObjectId string or label match)
      if (resolvedPlanId) {
        matchedPlan = product.plans.find(
          (p) =>
            (p._id && String(p._id) === resolvedPlanId) ||
            (p.id && String(p.id) === resolvedPlanId) ||
            String(p.label).trim().toLowerCase() === resolvedPlanId.toLowerCase()
        );
      }

      // Try matching by planLabel
      if (!matchedPlan && planLabel) {
        matchedPlan = product.plans.find(
          (p) =>
            String(p.label).trim().toLowerCase() === String(planLabel).trim().toLowerCase()
        );
      }

      // Try matching by planDays
      if (!matchedPlan && planDays !== undefined && planDays !== null) {
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
      resolvedPlanId = matchedPlan._id ? String(matchedPlan._id) : (matchedPlan.label || resolvedPlanId);
      selectedPlanData = {
        label:
          matchedPlan.label ||
          (matchedPlan.days === 0 ? "Lifetime" : `${matchedPlan.days} Days`),
        days: Number(matchedPlan.days) || 0,
        price: unitPrice,
      };
    }

    const basePrice = unitPrice * qty;

    // 3b. Re-validate any coupon on the server and apply the discount
    let couponDiscount = 0;
    let appliedCoupon = null;
    const cleanCoupon = String(couponCode || "").trim();
    if (cleanCoupon) {
      const couponOffer = await getCouponOffer(cleanCoupon, product._id);
      if (couponOffer) {
        couponDiscount = calculateDiscount(basePrice, couponOffer);
        if (couponDiscount > 0) {
          appliedCoupon = {
            code: couponOffer.couponCode,
            discount: couponDiscount,
            label: couponOffer.discountLabel || "",
          };
        }
      }
    }

    const totalPrice = Math.round((basePrice - couponDiscount) * 100) / 100;
    // Calculate total amount in integer paise (₹1 = 100 paise)
    const totalAmountPaise = Math.round(totalPrice * 100);

    const fampayUpiId =
      process.env.FAMPAY_UPI_ID || process.env.UPI_ID || "rishabh04@fam";
    const upiName = process.env.UPI_NAME || "RISHABH JH10C PAY";

    // 4. Reuse Existing Unexpired Pending Order for the same Product & Plan
    const now = new Date();
    const userOr = [
      { userId: session.user.id },
      { discordId: session.user.id },
      ...(userDoc?._id ? [{ user: userDoc._id }] : []),
    ];
    const productOr = [{ productId: product._id }, { product: product._id }];

    const reuseFilter = {
      $and: [
        { $or: userOr },
        { $or: productOr },
        { status: "pending" },
        { expiresAt: { $gt: now } },
      ],
    };

    if (resolvedPlanId) {
      reuseFilter.$and.push({
        $or: [
          { planId: resolvedPlanId },
          ...(selectedPlanData?.label ? [{ "plan.label": selectedPlanData.label }] : []),
        ],
      });
    } else if (selectedPlanData?.label) {
      reuseFilter.$and.push({ "plan.label": selectedPlanData.label });
    }

    // Only reuse an order that was created with the same coupon (or no coupon)
    if (appliedCoupon) {
      reuseFilter.$and.push({ couponCode: appliedCoupon.code });
    } else {
      reuseFilter.$and.push({
        $or: [{ couponCode: { $exists: false } }, { couponCode: "" }],
      });
    }

    const existingPendingOrder = await Order.findOne(reuseFilter).sort({ createdAt: -1 });

    if (existingPendingOrder) {
      if (
        existingPendingOrder.productKey !== productKey ||
        existingPendingOrder.productName !== product.name
      ) {
        await Order.updateOne(
          { _id: existingPendingOrder._id },
          { $set: { productKey, productName: product.name } }
        );
      }

      const orderAmountPaise =
        existingPendingOrder.amountPaise || Math.round((Number(existingPendingOrder.price) || 0) * 100);
      const formattedAmount = (orderAmountPaise / 100).toFixed(2);
      const upiLink = `upi://pay?pa=${encodeURIComponent(fampayUpiId)}&pn=${encodeURIComponent(upiName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(String(existingPendingOrder._id))}`;

      return NextResponse.json({
        ok: true,
        reused: true,
        orderId: String(existingPendingOrder._id),
        amount: Number(formattedAmount),
        amountPaise: orderAmountPaise,
        upiLink,
        checkoutUrl: `/checkout/${existingPendingOrder._id}`,
        order: toPlainText(existingPendingOrder),
      });
    }

    // 5. Enforce the anti-spam cooldown for NEW orders (Admin is exempt).
    //    The check below is advisory; the atomic `lastOrderAt` gate right after
    //    it prevents two concurrent requests from both creating an order.
    const isAdmin = Boolean(session.user.isAdmin);
    if (!isAdmin) {
      const cooldownMinutesSetting = await getSetting(
        "order_cooldown_minutes",
        process.env.ORDER_COOLDOWN_MINUTES || 10
      );
      const cooldownMinutes = Math.max(1, Number(cooldownMinutesSetting) || 10);
      const cooldownMs = cooldownMinutes * 60 * 1000;
      const cutoff = new Date(Date.now() - cooldownMs);

      const latestOrder = await Order.findOne({ $or: userOr })
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

      // Atomic gate: only one request can win this update per cooldown window.
      const gate = await User.findOneAndUpdate(
        {
          discordId: session.user.id,
          $or: [
            { lastOrderAt: { $exists: false } },
            { lastOrderAt: null },
            { lastOrderAt: { $lte: cutoff } },
          ],
        },
        { $set: { lastOrderAt: new Date() } },
        { new: false }
      ).lean();

      if (!gate) {
        const waitSeconds = Math.max(
          1,
          Math.ceil(cooldownMs / 1000)
        );
        return NextResponse.json(
          {
            error: "An order is already being created. Please wait a moment and try again.",
            remainingSeconds: waitSeconds,
          },
          { status: 429 }
        );
      }
    }

    // 6. Create the pending order with 10-minute expiration & integer amountPaise
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const order = await Order.create({
      userId: session.user.id,
      user: userDoc._id,
      productId: product._id,
      product: product._id,
      planId: resolvedPlanId,
      amountPaise: totalAmountPaise,
      price: totalPrice,
      amount: totalPrice,
      originalPrice: basePrice,
      couponCode: appliedCoupon?.code || "",
      couponDiscount: couponDiscount,
      status: "pending",
      expiresAt,
      productName: product.name,
      productKey,
      customerName: session.user.name || userDoc.username || "Discord User",
      email: session.user.email || userDoc.email || "",
      discordId: session.user.id,
      quantity: qty,
      notes: String(notes || "").trim(),
      ...(selectedPlanData ? { plan: selectedPlanData } : {}),
    });

    // 7. Generate UPI payment intent link
    const formattedAmount = (totalAmountPaise / 100).toFixed(2);
    const upiLink = `upi://pay?pa=${encodeURIComponent(fampayUpiId)}&pn=${encodeURIComponent(upiName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(String(order._id))}`;

    // 8. Update global store counters
    await incrementStat("orders");

    revalidatePath("/dashboard");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      orderId: String(order._id),
      amount: Number(formattedAmount),
      amountPaise: totalAmountPaise,
      upiLink,
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
export async function GET(request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const userDoc = await User.findOne({ discordId: session.user.id }).lean();

    // Hard cap: never return an unbounded order list.
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
      : 100;

    const orders = await Order.find(ownerFilterFor(session, userDoc))
      .populate("product")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const safeOrders = toPlainText(orders).map((order) =>
      redactOrderLicense(order, session)
    );

    return NextResponse.json({ ok: true, orders: safeOrders });
  } catch (err) {
    console.error("GET /api/orders failed:", err);
    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 }
    );
  }
}
