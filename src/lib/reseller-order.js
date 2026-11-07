import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { completeOrder } from "@/lib/fulfillment";
import { findUserForSession, linkedDiscordId } from "@/lib/account";
import { toPlainText } from "@/lib/serialize";
import { getSetting } from "@/lib/settings";
import { generateOrderNo } from "@/lib/order-number";
import { incrementStat } from "@/lib/stats";
import {
  beginIdempotency,
  completeIdempotency,
  failIdempotency,
  hashRequestBody,
} from "@/lib/idempotency";
import {
  RESELLER_ORDER_TYPE,
  RESELLER_PRICE,
  RESELLER_PRICE_PAISE,
  RESELLER_PRODUCT_NAME,
} from "@/lib/reseller";

const RESELLER_ORDER_TTL_MS = 15 * 60 * 1000;
const RESELLER_TERMS_VERSION = "v1";

function buildResellerResponse(order, reused = false) {
  const fampayUpiId =
    process.env.FAMPAY_UPI_ID || process.env.UPI_ID || "rishabh04@fam";
  const upiName = process.env.UPI_NAME || "RISHABH JH10C PAY";
  const amountPaise =
    Number(order.amountPaise) || Math.round((Number(order.price) || 0) * 100);
  const formattedAmount = (amountPaise / 100).toFixed(2);
  const upiLink = `upi://pay?pa=${encodeURIComponent(
    fampayUpiId
  )}&pn=${encodeURIComponent(upiName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(
    String(order._id)
  )}`;

  return {
    ok: true,
    ...(reused ? { reused: true } : {}),
    orderId: String(order._id),
    amount: Number(formattedAmount),
    amountPaise,
    upiLink,
    checkoutUrl: `/checkout/${order._id}`,
    order: toPlainText(order),
  };
}

/**
 * Create (or reuse) the pending ₹149 lifetime reseller membership order.
 * Reuses the exact same idempotency, cooldown and UPI flow as normal orders.
 */
export async function createResellerOrder({
  session,
  idempotencyKey = "",
  endpoint = "POST /api/reseller/join",
  termsAccepted = false,
  refundAckAccepted = false,
}) {
  await connectDB();

  if (termsAccepted !== true || refundAckAccepted !== true) {
    return {
      status: 400,
      body: {
        error:
          "Please accept the Reseller Terms & Conditions and the non-refundable acknowledgement before joining.",
      },
    };
  }

  let idempotency = { mode: "none" };

  const fail = async (status, payload) => {
    if (idempotency?.id) {
      await failIdempotency(
        idempotency.id,
        payload?.error || "Reseller request failed."
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
        requestHash: hashRequestBody({ type: RESELLER_ORDER_TYPE }),
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

    let userDoc = await findUserForSession(session);
    if (!userDoc) {
      return fail(401, {
        error: "Your session expired. Please sign in again.",
      });
    }

    if (userDoc.isReseller) {
      return fail(409, { error: "You are already a Reseller." });
    }

    const accountUserId = String(userDoc._id);
    const discordId = linkedDiscordId(userDoc);
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

    // 1. Reuse an unexpired pending membership order (no duplicate orders).
    const now = new Date();
    const existingPendingOrder = await Order.findOne({
      $and: [
        { $or: userOr },
        { orderType: RESELLER_ORDER_TYPE },
        { status: "pending" },
        { expiresAt: { $gt: now } },
      ],
    }).sort({ createdAt: -1 });

    if (existingPendingOrder) {
      const acceptedTermsAt = existingPendingOrder.acceptedTermsAt || new Date();
      const termsVersion = RESELLER_TERMS_VERSION;

      await Order.updateOne(
        { _id: existingPendingOrder._id },
        { $set: { acceptedTermsAt, termsVersion } }
      );
      existingPendingOrder.acceptedTermsAt = acceptedTermsAt;
      existingPendingOrder.termsVersion = termsVersion;

      return succeed(buildResellerResponse(existingPendingOrder, true));
    }

    // 2. Same anti-spam cooldown as normal orders (admin is exempt).
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
            error: `Order cooldown active. You can join the Reseller program in ${formattedTime}.`,
            remainingSeconds,
          });
        }
      }

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

    // 3. Create the pending membership order.
    const orderId = new Order()._id;
    const order = await Order.create({
      _id: orderId,
      orderNo: generateOrderNo(),
      orderType: RESELLER_ORDER_TYPE,
      userId: accountUserId,
      user: userDoc._id,
      amountPaise: RESELLER_PRICE_PAISE,
      price: RESELLER_PRICE,
      amount: RESELLER_PRICE,
      originalPrice: RESELLER_PRICE,
      acceptedTermsAt: new Date(),
      termsVersion: RESELLER_TERMS_VERSION,
      status: "pending",
      expiresAt: new Date(Date.now() + RESELLER_ORDER_TTL_MS),
      productName: RESELLER_PRODUCT_NAME,
      deliveryType: "content",
      customerName: session.user.name || userDoc.username || "Customer",
      email: session.user.email || userDoc.email || "",
      discordId,
      quantity: 1,
      notes: "Lifetime reseller membership",
    });

    await incrementStat("orders");

    return succeed(buildResellerResponse(order));
  } catch (err) {
    console.error("createResellerOrder failed:", err);
    return fail(500, {
      error: "Failed to start the Reseller membership. Please try again.",
    });
  }
}

/**
 * Flip the buyer's account to reseller. Atomic so concurrent webhook/UTR
 * verification can only activate the membership once.
 */
export async function activateResellerForOrder(order) {
  if (!order) return { ok: false, reason: "missing_order" };
  await connectDB();

  const candidateUserId = String(order.user || "");
  const fallbackUserId = String(order.userId || "");
  const userId = /^[a-f\d]{24}$/i.test(candidateUserId)
    ? candidateUserId
    : /^[a-f\d]{24}$/i.test(fallbackUserId)
    ? fallbackUserId
    : "";

  if (!userId) return { ok: false, reason: "missing_user" };

  const orderNo = String(order.orderNo || order._id || "");
  const result = await User.updateOne(
    { _id: userId, isReseller: { $ne: true } },
    {
      $set: {
        isReseller: true,
        resellerSince: new Date(),
        resellerOrderNo: orderNo,
      },
    }
  );

  return { ok: true, activated: result.modifiedCount === 1 };
}

/**
 * Shared post-payment finalizer. Reseller orders are marked completed without
 * any license/content delivery; normal orders go through completeOrder().
 */
export async function finalizePaidOrder(order) {
  if (!order) return null;

  if (order.orderType === RESELLER_ORDER_TYPE) {
    await activateResellerForOrder(order);

    const completed = await Order.findOneAndUpdate(
      { _id: order._id, status: { $in: ["paid", "processing"] } },
      { $set: { status: "completed", deliveredAt: new Date() } },
      { new: true }
    ).lean();

    return completed || order;
  }

  const fulfillment = await completeOrder(order._id);
  return fulfillment?.order || order;
}
