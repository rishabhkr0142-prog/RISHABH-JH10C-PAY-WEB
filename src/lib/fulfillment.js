import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import User from "@/models/User";
import { generateKey } from "@/lib/mani";
import { sendOrderDM } from "@/lib/discord";
import { isRealDiscordId, linkedDiscordId } from "@/lib/account";
import {
  findProductPlan,
  isContentDelivery,
  resolveDeliveryContent,
} from "@/lib/delivery-content";
import { claimProductStockItem } from "@/lib/product-stock";
import { notifySaleCompleted } from "@/lib/discord-sale-webhook";

/**
 * Server-side fulfillment pipeline.
 *
 * completeOrder() is the ONLY place where a license key or content delivery
 * snapshot is created. It is called after a payment has been verified
 * (status "paid") from:
 *   - the UPI webhook
 *   - buyer UTR verification
 *   - admin manual payment match
 *   - admin marking an order as paid
 *
 * The atomic findOneAndUpdate lock guarantees one order -> one delivery, even
 * if two webhooks / retries arrive at the same time.
 */

const STALE_PROCESSING_MS = 3 * 60 * 1000;
const ERROR_MAX_LENGTH = 500;

const contentMissingFilter = {
  $or: [{ deliveryContent: { $exists: false } }, { deliveryContent: null }],
};
const licenseMissingFilter = {
  $or: [
    { licenseKey: { $exists: false } },
    { licenseKey: null },
    { licenseKey: "" },
  ],
};

function safeError(err) {
  const message =
    typeof err === "string" ? err : err?.message || "Unknown fulfillment error";
  return String(message).slice(0, ERROR_MAX_LENGTH);
}

function isContentOrder(order) {
  return isContentDelivery(order?.deliveryType);
}

function hasDelivery(order) {
  return isContentOrder(order)
    ? Boolean(order?.deliveryContent)
    : Boolean(order?.licenseKey);
}

async function failContentDelivery(id, message) {
  await Order.updateOne(
    { _id: id, status: "processing", ...contentMissingFilter },
    {
      $set: {
        status: "paid",
        deliveryError: safeError(message),
      },
      $inc: { deliveryAttempts: 1 },
    }
  );
}

async function fulfillContentOrder(lockedOrder, id) {
  const productId = lockedOrder.productId || lockedOrder.product;
  const product = productId ? await Product.findById(productId).lean() : null;

  if (!product) {
    const error = "The product for this order no longer exists.";
    await failContentDelivery(id, error);
    return { ok: false, reason: "generation_failed", error };
  }

  const plan = findProductPlan(product, lockedOrder);
  const resolved = resolveDeliveryContent(product, plan, lockedOrder);

  if (!resolved.ok) {
    const error =
      "This product's delivery details are not configured yet. Please contact support.";
    await failContentDelivery(id, error);
    return { ok: false, reason: "generation_failed", error };
  }

  let stockItem = "";
  if (product.useStockItems) {
    let claimedItem = null;
    try {
      claimedItem = await claimProductStockItem(product._id, lockedOrder._id);
    } catch (err) {
      const error = safeError(err);
      await failContentDelivery(id, error);
      return { ok: false, reason: "generation_failed", error };
    }

    if (!claimedItem) {
      const error =
        "This product is out of stock. Please contact support for a replacement.";
      await failContentDelivery(id, error);
      return { ok: false, reason: "out_of_stock", error };
    }

    stockItem = claimedItem.value;
  }

  const deliveryContent = {
    ...resolved.content,
    stockItem,
  };

  const completed = await Order.findOneAndUpdate(
    { _id: id, status: "processing", ...contentMissingFilter },
    {
      $set: {
        status: "completed",
        deliveryType: "content",
        deliveryContent,
        deliveredAt: new Date(),
        deliveryError: "",
        licenseError: "",
      },
      $inc: { deliveryAttempts: 1 },
    },
    { new: true }
  ).lean();

  if (!completed) {
    const existing = await Order.findById(id).lean();
    return existing
      ? { ok: true, alreadyCompleted: true, order: existing }
      : { ok: false, reason: "not_found" };
  }

  return { ok: true, order: completed };
}

async function fulfillLicenseOrder(lockedOrder, id) {
  let licenseKey;
  try {
    licenseKey = await generateKey(
      lockedOrder.productKey,
      lockedOrder.planId,
      lockedOrder.plan
    );
  } catch (err) {
    const error = safeError(err);
    await Order.updateOne(
      { _id: id, status: "processing", ...licenseMissingFilter },
      {
        $set: {
          status: "paid",
          licenseError: error,
        },
        $inc: { licenseAttempts: 1 },
      }
    );
    return { ok: false, reason: "generation_failed", error };
  }

  const completed = await Order.findOneAndUpdate(
    { _id: id, status: "processing", ...licenseMissingFilter },
    {
      $set: {
        status: "completed",
        deliveryType: "license",
        licenseKey,
        deliveredAt: new Date(),
        licenseError: "",
        deliveryError: "",
      },
      $inc: { licenseAttempts: 1 },
    },
    { new: true }
  ).lean();

  if (!completed) {
    const existing = await Order.findById(id).lean();
    return existing
      ? { ok: true, alreadyCompleted: true, order: existing }
      : { ok: false, reason: "not_found" };
  }

  return { ok: true, order: completed };
}

/**
 * Generate the delivery for a paid order, then DM the buyer.
 *
 * @param {string|object} orderId
 * @returns {Promise<{ ok: boolean, reason?: string, order?: object }>}
 */
export async function completeOrder(orderId) {
  const id = String(orderId || "");
  if (!/^[a-f\d]{24}$/i.test(id)) {
    return { ok: false, reason: "invalid_order_id" };
  }

  await connectDB();

  // 1. Atomic lock — prevents double delivery (webhook race / double click).
  const lockedOrder = await Order.findOneAndUpdate(
    {
      _id: id,
      status: "paid",
      $or: [
        { deliveryType: "content", ...contentMissingFilter },
        { deliveryType: { $ne: "content" }, ...licenseMissingFilter },
      ],
    },
    {
      $set: {
        status: "processing",
        licenseError: "",
        deliveryError: "",
      },
    },
    { new: true }
  );

  if (!lockedOrder) {
    const existing = await Order.findById(id).lean();
    if (!existing) return { ok: false, reason: "not_found" };
    if (hasDelivery(existing)) {
      return { ok: true, alreadyCompleted: true, order: existing };
    }
    if (existing.status === "processing") {
      return { ok: false, reason: "processing", order: existing };
    }
    return { ok: false, reason: "not_paid", order: existing };
  }

  // 2. Generate/persist the delivery according to the order type.
  const result = isContentOrder(lockedOrder)
    ? await fulfillContentOrder(lockedOrder, id)
    : await fulfillLicenseOrder(lockedOrder, id);

  if (!result.ok) return result;
  if (result.alreadyCompleted) return result;

  const completed = result.order;

  // 3. Discord DM is a separate best-effort step. A DM failure never rolls
  //    back a completed order — it is recorded so it can be resent later.
  let finalOrder = completed;

  let discordId = isRealDiscordId(completed.discordId)
    ? String(completed.discordId).trim()
    : "";

  if (!discordId && completed.user) {
    const buyer = await User.findById(completed.user).lean();
    discordId = linkedDiscordId(buyer);
  }

  // Legacy orders stored the Discord ID in userId.
  if (!discordId && isRealDiscordId(completed.userId)) {
    discordId = String(completed.userId).trim();
  }

  // Google-only accounts have no Discord identity yet. The order is still
  // completed and delivery is visible in the dashboard; DM is skipped.
  if (!discordId) {
    finalOrder = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          dmSent: false,
          dmError: "",
          dmSkipReason: "discord_not_linked",
          dmSentAt: null,
        },
      },
      { new: true }
    ).lean();

    return { ok: true, order: finalOrder || completed };
  }

  try {
    await sendOrderDM({ discordId, order: completed });

    finalOrder = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          discordId,
          dmSent: true,
          dmError: "",
          dmSkipReason: "",
          dmSentAt: new Date(),
        },
      },
      { new: true }
    ).lean();
  } catch (err) {
    finalOrder = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          dmSent: false,
          dmError: safeError(err),
          dmSkipReason: "",
        },
      },
      { new: true }
    ).lean();
  }

  // 4. Trigger Discord sale webhook asynchronously in background (never blocks fulfillment)
  notifySaleCompleted(completed._id).catch((notifyErr) => {
    console.error("Async sale notification trigger error:", notifyErr?.message || notifyErr);
  });

  return { ok: true, order: finalOrder || completed };
}

/**
 * Retry fulfillment for an order that is paid but has no delivery yet.
 * Also recovers orders stuck in "processing" after a crashed request.
 */
export async function retryOrderFulfillment(orderId) {
  const id = String(orderId || "");
  if (!/^[a-f\d]{24}$/i.test(id)) {
    return { ok: false, reason: "invalid_order_id" };
  }

  await connectDB();

  const order = await Order.findById(id).lean();
  if (!order) return { ok: false, reason: "not_found" };
  if (hasDelivery(order)) {
    return { ok: true, alreadyCompleted: true, order };
  }

  const content = isContentOrder(order);
  const missing = content ? contentMissingFilter : licenseMissingFilter;

  if (order.status === "processing") {
    const updatedAt = new Date(order.updatedAt || 0).getTime();
    if (Date.now() - updatedAt < STALE_PROCESSING_MS) {
      return { ok: false, reason: "processing", order };
    }

    // Recover a stale lock left behind by a crashed request.
    await Order.updateOne(
      { _id: id, status: "processing", ...missing },
      { $set: { status: "paid" } }
    );
  } else if (order.status === "completed") {
    // Completed manually without delivery — put it back into the paid state.
    await Order.updateOne(
      { _id: id, status: "completed", ...missing },
      { $set: { status: "paid" } }
    );
  } else if (order.status !== "paid") {
    return { ok: false, reason: "not_paid", order };
  }

  return completeOrder(id);
}

export default completeOrder;
