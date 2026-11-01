import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { generateKey } from "@/lib/mani";
import { sendLicenseDM } from "@/lib/discord";

/**
 * Server-side license fulfillment pipeline.
 *
 * completeOrder() is the ONLY place where a key is generated.
 * It is called after a payment has been verified (status "paid") from:
 *   - the UPI webhook
 *   - buyer UTR verification
 *   - admin manual payment match
 *   - admin marking an order as paid
 *
 * The atomic findOneAndUpdate lock guarantees one order -> one key, even if
 * two webhooks / retries arrive at the same time.
 */

const STALE_PROCESSING_MS = 3 * 60 * 1000;
const ERROR_MAX_LENGTH = 500;

function safeError(err) {
  const message =
    typeof err === "string" ? err : err?.message || "Unknown fulfillment error";
  return String(message).slice(0, ERROR_MAX_LENGTH);
}

/**
 * Generate the license key for a paid order, then DM the buyer.
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

  // 1. Atomic lock — prevents double key generation (webhook race / double click).
  const lockedOrder = await Order.findOneAndUpdate(
    {
      _id: id,
      status: "paid",
      licenseKey: { $exists: false },
    },
    {
      $set: {
        status: "processing",
        licenseError: "",
      },
    },
    { new: true }
  );

  if (!lockedOrder) {
    const existing = await Order.findById(id).lean();
    if (!existing) return { ok: false, reason: "not_found" };
    if (existing.licenseKey) {
      return { ok: true, alreadyCompleted: true, order: existing };
    }
    if (existing.status === "processing") {
      return { ok: false, reason: "processing", order: existing };
    }
    return { ok: false, reason: "not_paid", order: existing };
  }

  // 2. Generate the license key server-side only.
  let licenseKey;
  try {
    licenseKey = await generateKey(lockedOrder);
  } catch (err) {
    const error = safeError(err);
    await Order.updateOne(
      { _id: id, status: "processing", licenseKey: { $exists: false } },
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

  // 3. Persist delivery.
  const completed = await Order.findOneAndUpdate(
    { _id: id, status: "processing", licenseKey: { $exists: false } },
    {
      $set: {
        status: "completed",
        licenseKey,
        deliveredAt: new Date(),
        licenseError: "",
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

  // 4. Discord DM is a separate best-effort step. A DM failure never rolls
  //    back a completed order — it is recorded so it can be resent later.
  let finalOrder = completed;

  try {
    const discordId = String(completed.discordId || completed.userId || "").trim();
    if (!discordId) {
      throw new Error("Buyer Discord ID is missing on this order.");
    }

    await sendLicenseDM({ discordId, order: completed });

    finalOrder = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          dmSent: true,
          dmError: "",
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
        },
      },
      { new: true }
    ).lean();
  }

  return { ok: true, order: finalOrder || completed };
}

/**
 * Retry fulfillment for an order that is paid but has no key yet.
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
  if (order.licenseKey) {
    return { ok: true, alreadyCompleted: true, order };
  }

  if (order.status === "processing") {
    const updatedAt = new Date(order.updatedAt || 0).getTime();
    if (Date.now() - updatedAt < STALE_PROCESSING_MS) {
      return { ok: false, reason: "processing", order };
    }

    // Recover a stale lock left behind by a crashed request.
    await Order.updateOne(
      { _id: id, status: "processing", licenseKey: { $exists: false } },
      { $set: { status: "paid" } }
    );
  } else if (order.status === "completed") {
    // Completed manually without a key — put it back into the paid state.
    await Order.updateOne(
      { _id: id, status: "completed", licenseKey: { $exists: false } },
      { $set: { status: "paid" } }
    );
  } else if (order.status !== "paid") {
    return { ok: false, reason: "not_paid", order };
  }

  return completeOrder(id);
}

export default completeOrder;
