import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Order from "@/models/Order";
import User from "@/models/User";
import { incrementStat } from "@/lib/stats";
import {
  findUserForSession,
  isRealDiscordId,
  linkedDiscordId,
} from "@/lib/account";
import { toPlainText } from "@/lib/serialize";
import { getSetting } from "@/lib/settings";
import { getCouponOffer } from "@/lib/offers";
import { calculateDiscount } from "@/lib/offer-utils";
import { normalizeProductKey } from "@/lib/product-keys";
import {
  normalizeDeliveryType,
  resolveDeliveryContent,
} from "@/lib/delivery-content";
import {
  countAvailableStockItems,
  releaseStockReservationSnapshot,
  reserveStock,
  STOCK_RESERVATION_TTL_MS,
} from "@/lib/product-stock";
import {
  beginIdempotency,
  completeIdempotency,
  failIdempotency,
  hashRequestBody,
} from "@/lib/idempotency";

/**
 * Create a pending order for an authenticated session.
 *
 * Returns a plain `{ status, body }` result so the route handler stays thin and
 * the flow can be exercised by the concurrency test script without Next.js.
 * Idempotency, stock reservation, cooldown gating and order creation are all
 * performed server-side; the client price is never trusted.
 */
export async function createOrder({
  session,
  body = {},
  idempotencyKey = "",
  endpoint = "POST /api/orders",
}) {
  await connectDB();

  let idempotency = { mode: "none" };

  const fail = async (status, payload) => {
    if (idempotency?.id) {
      await failIdempotency(
        idempotency.id,
        payload?.error || "Order request failed."
      );
    }
    return { status, body: payload };
  };

  const succeed = async (payload) => {
    if (idempotency?.id) {
      await completeIdempotency(idempotency.id, payload, 200);
    }
    return { status: 200, body: payload };
  };

  try {
    const key = String(idempotencyKey || "").trim();
    if (key) {
      idempotency = await beginIdempotency({
        userId: String(session?.user?.id || ""),
        endpoint,
        key,
        requestHash: hashRequestBody(body),
      });

      if (idempotency.mode === "replay") {
        return {
          status: idempotency.status || 200,
          body: idempotency.response,
          replayed: true,
        };
      }

      if (idempotency.mode === "conflict") {
        return {
          status: idempotency.status || 409,
          body: {
            error:
              idempotency.error ||
              "A request with this Idempotency-Key is already processing.",
          },
        };
      }
    }

    const {
      productId,
      planId,
      quantity = 1,
      notes = "",
      planLabel,
      planDays,
      couponCode,
    } = body || {};

    if (!productId || !/^[a-f\d]{24}$/i.test(String(productId))) {
      return fail(400, { error: "A valid product ID is required." });
    }

    // 1. Fetch product
    const product = await Product.findById(productId);
    if (!product || product.active === false || product.available === false) {
      return fail(404, {
        error: "Product is not available for purchase.",
      });
    }

    // Delivery type and license app are always taken from the server-side
    // product record, never from the request body.
    const deliveryType = normalizeDeliveryType(product.deliveryType);
    const productKey = normalizeProductKey(product.productKey);
    if (deliveryType === "license" && !productKey) {
      return fail(400, {
        error:
          "This product is not configured for automatic license delivery. Please contact support.",
      });
    }

    // 2. Resolve the canonical MongoDB account for this session.
    let userDoc = await findUserForSession(session);
    if (!userDoc) {
      const legacyDiscordId = session.user.discordId || session.user.id;
      if (!isRealDiscordId(legacyDiscordId)) {
        return fail(401, {
          error: "Your session expired. Please sign in again.",
        });
      }

      userDoc = await User.create({
        discordId: String(legacyDiscordId),
        username: session.user.name || String(legacyDiscordId),
        avatar: session.user.image || "",
        email: session.user.email || "",
        authProviders: { discord: { id: String(legacyDiscordId) } },
      });
      await incrementStat("users");
    }

    const accountUserId = String(userDoc._id);
    const discordId = linkedDiscordId(userDoc);

    // 3. Server-Side Price & Duration Plan Verification (Never trust client price)
    const qty = Math.max(1, Number(quantity) || 1);
    let unitPrice = Number(product.price) || 0;
    let selectedPlanData = null;
    let selectedPlanDoc = null;
    let resolvedPlanId = planId ? String(planId).trim() : "";

    if (Array.isArray(product.plans) && product.plans.length > 0) {
      let matchedPlan = null;

      if (resolvedPlanId) {
        matchedPlan = product.plans.find(
          (p) =>
            (p._id && String(p._id) === resolvedPlanId) ||
            (p.id && String(p.id) === resolvedPlanId) ||
            String(p.label).trim().toLowerCase() === resolvedPlanId.toLowerCase()
        );
      }

      if (!matchedPlan && planLabel) {
        matchedPlan = product.plans.find(
          (p) =>
            String(p.label).trim().toLowerCase() ===
            String(planLabel).trim().toLowerCase()
        );
      }

      if (!matchedPlan && planDays !== undefined && planDays !== null) {
        matchedPlan = product.plans.find(
          (p) => Number(p.days) === Number(planDays)
        );
      }

      if (!matchedPlan) {
        matchedPlan = product.plans.reduce(
          (min, p) => (Number(p.price) < Number(min.price) ? p : min),
          product.plans[0]
        );
      }

      unitPrice = Number(matchedPlan.price);
      resolvedPlanId = matchedPlan._id
        ? String(matchedPlan._id)
        : matchedPlan.label || resolvedPlanId;
      selectedPlanDoc = matchedPlan;
      selectedPlanData = {
        label:
          matchedPlan.label ||
          (matchedPlan.days === 0 ? "Lifetime" : `${matchedPlan.days} Days`),
        days: Number(matchedPlan.days) || 0,
        price: unitPrice,
      };
    }

    if (deliveryType === "content") {
      const resolved = resolveDeliveryContent(product, selectedPlanDoc, {
        productName: product.name,
        plan: selectedPlanData,
      });
      if (!resolved.ok) {
        return fail(400, {
          error:
            "This product's delivery details are not configured yet. Please contact support.",
        });
      }
    }

    if (product.useStockItems) {
      const availableStock = await countAvailableStockItems(product._id);
      if (availableStock <= 0) {
        return fail(400, { error: "Product is currently out of stock." });
      }
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
    const totalAmountPaise = Math.round(totalPrice * 100);

    const fampayUpiId =
      process.env.FAMPAY_UPI_ID || process.env.UPI_ID || "rishabh04@fam";
    const upiName = process.env.UPI_NAME || "RISHABH JH10C PAY";

    // 4. Reuse Existing Unexpired Pending Order for the same Product & Plan
    const now = new Date();
    const userOr = [
      { userId: accountUserId },
      { user: userDoc._id },
      ...(String(session.user.id) !== accountUserId
        ? [{ userId: String(session.user.id) }]
        : []),
      ...(session.user.discordId
        ? [{ discordId: String(session.user.discordId) }]
        : []),
      ...(discordId ? [{ discordId }] : []),
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
          ...(selectedPlanData?.label
            ? [{ "plan.label": selectedPlanData.label }]
            : []),
        ],
      });
    } else if (selectedPlanData?.label) {
      reuseFilter.$and.push({ "plan.label": selectedPlanData.label });
    }

    if (appliedCoupon) {
      reuseFilter.$and.push({ couponCode: appliedCoupon.code });
    } else {
      reuseFilter.$and.push({
        $or: [{ couponCode: { $exists: false } }, { couponCode: "" }],
      });
    }

    const existingPendingOrder = await Order.findOne(reuseFilter).sort({
      createdAt: -1,
    });

    if (existingPendingOrder) {
      if (
        existingPendingOrder.productKey !== productKey ||
        existingPendingOrder.productName !== product.name ||
        existingPendingOrder.deliveryType !== deliveryType
      ) {
        await Order.updateOne(
          { _id: existingPendingOrder._id },
          {
            $set: {
              productKey,
              productName: product.name,
              deliveryType,
            },
          }
        );
      }

      const orderAmountPaise =
        existingPendingOrder.amountPaise ||
        Math.round((Number(existingPendingOrder.price) || 0) * 100);
      const formattedAmount = (orderAmountPaise / 100).toFixed(2);
      const upiLink = `upi://pay?pa=${encodeURIComponent(
        fampayUpiId
      )}&pn=${encodeURIComponent(upiName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(
        String(existingPendingOrder._id)
      )}`;

      return succeed({
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
    //    The advisory check is followed by an atomic `lastOrderAt` gate.
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
          const formattedTime = `${String(mins).padStart(2, "0")}:${String(
            secs
          ).padStart(2, "0")}`;

          return fail(429, {
            error: `Order cooldown active. You can place another order in ${formattedTime}.`,
            remainingSeconds,
          });
        }
      }

      // Atomic gate: only one request can win this update per cooldown window.
      const gate = await User.findOneAndUpdate(
        {
          _id: userDoc._id,
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
        const waitSeconds = Math.max(1, Math.ceil(cooldownMs / 1000));
        return fail(429, {
          error:
            "An order is already being created. Please wait a moment and try again.",
          remainingSeconds: waitSeconds,
        });
      }
    }

    // 6. Reserve inventory atomically BEFORE creating the order.
    const orderId = new Order()._id;
    const reservation = await reserveStock({
      product,
      plan: selectedPlanDoc,
      quantity: qty,
      orderId,
      planLabel: selectedPlanData?.label || "",
    });

    if (!reservation.ok) {
      return fail(
        reservation.reason === "out_of_stock" ? 400 : 409,
        {
          error:
            reservation.reason === "out_of_stock"
              ? "Product is currently out of stock."
              : "This product cannot be ordered right now. Please contact support.",
        }
      );
    }

    // 7. Create the pending order with 15-minute expiration & integer amountPaise
    const expiresAt = new Date(Date.now() + STOCK_RESERVATION_TTL_MS);
    let order;

    try {
      order = await Order.create({
        _id: orderId,
        userId: accountUserId,
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
        deliveryType,
        customerName: session.user.name || userDoc.username || "Customer",
        email: session.user.email || userDoc.email || "",
        discordId,
        quantity: qty,
        stockReserved: Boolean(reservation.reserved),
        stockCommitted: false,
        stockReleased: false,
        stockReservation: reservation.snapshot,
        stockReservationExpiresAt: reservation.reserved
          ? new Date(Date.now() + STOCK_RESERVATION_TTL_MS)
          : null,
        notes: String(notes || "").trim(),
        ...(selectedPlanData ? { plan: selectedPlanData } : {}),
      });
    } catch (createErr) {
      if (reservation.reserved) {
        await releaseStockReservationSnapshot(
          reservation.snapshot,
          orderId,
          "order_create_failed"
        );
      }
      throw createErr;
    }

    // 7b. Generate UPI payment intent link
    const formattedAmount = (totalAmountPaise / 100).toFixed(2);
    const upiLink = `upi://pay?pa=${encodeURIComponent(
      fampayUpiId
    )}&pn=${encodeURIComponent(upiName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(
      String(order._id)
    )}`;

    // 8. Update global store counters
    await incrementStat("orders");

    return succeed({
      ok: true,
      orderId: String(order._id),
      amount: Number(formattedAmount),
      amountPaise: totalAmountPaise,
      upiLink,
      checkoutUrl: `/checkout/${order._id}`,
      order: toPlainText(order),
    });
  } catch (err) {
    console.error("createOrder failed:", err);
    return fail(500, {
      error: "Failed to place order. Please try again.",
    });
  }
}

export default createOrder;
