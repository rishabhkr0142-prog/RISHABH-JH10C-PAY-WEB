import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Order from "@/models/Order";
import ProductStockItem from "@/models/ProductStockItem";
import StockLog from "@/models/StockLog";
import { findProductPlan } from "@/lib/delivery-content";
import { sendAdminStockAlert } from "@/lib/discord";
import {
  DEFAULT_LOW_STOCK_ALERT_THRESHOLD,
  getPlanStockInfo,
  normalizeStockMode,
  planDisplayLabel,
} from "@/lib/stock";

/**
 * Server-only helpers for the optional unique stock-item pool and the
 * product/plan inventory counter.
 * Public product documents never include individual item values.
 */

export const STOCK_RESERVATION_TTL_MS = 15 * 60 * 1000;

let lastAutoReleaseAt = 0;

function asList(value) {
  return Array.isArray(value) ? value : [value].filter(Boolean);
}

function quantityOf(value) {
  return Math.max(1, Math.floor(Number(value) || 1));
}

function isObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ""));
}

function planSelector(source) {
  const id = String(source?._id || source?.planId || "").trim();
  if (isObjectId(id)) return { _id: new mongoose.Types.ObjectId(id) };

  const label = String(source?.label || source?.planLabel || "").trim();
  if (label) return { label };

  const days = source?.days;
  if (days !== undefined && days !== null && days !== "") {
    return { days: Number(days) };
  }

  return null;
}

function matchesPlan(docPlan, source) {
  const id = String(source?._id || source?.planId || "").trim();
  if (isObjectId(id)) return String(docPlan?._id || "") === id;

  const label = String(source?.label || source?.planLabel || "").trim();
  if (label) return String(docPlan?.label || "").trim() === label;

  const days = source?.days;
  if (days !== undefined && days !== null && days !== "") {
    return Number(docPlan?.days) === Number(days);
  }

  return false;
}

function findUpdatedPlan(product, source) {
  const plans = Array.isArray(product?.plans) ? product.plans : [];
  return plans.find((plan) => matchesPlan(plan, source)) || null;
}

function stockModeElemFilter(source, product) {
  const raw = source?.stockMode;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    return { stockMode: normalizeStockMode(raw) };
  }

  const fallback = normalizeStockMode(product?.stockMode, "unlimited");
  return {
    $or: [
      { stockMode: fallback },
      { stockMode: { $exists: false } },
      { stockMode: null },
    ],
  };
}

function alertThreshold() {
  const value = Number(process.env.LOW_STOCK_ALERT_THRESHOLD);
  return Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : DEFAULT_LOW_STOCK_ALERT_THRESHOLD;
}

export async function recordStockLog({
  productId,
  productName = "",
  planId = "",
  planLabel = "",
  scope = "product",
  action,
  quantity = 0,
  delta = 0,
  stockBefore = null,
  stockAfter = null,
  reservedAfter = null,
  orderId = null,
  adminId = "",
  note = "",
}) {
  try {
    await StockLog.create({
      productId,
      productName,
      planId,
      planLabel,
      scope,
      action,
      quantity,
      delta,
      stockBefore,
      stockAfter,
      reservedAfter,
      orderId: isObjectId(orderId) ? orderId : null,
      adminId: String(adminId || ""),
      note: String(note || "").slice(0, 500),
    });
  } catch (err) {
    console.error("Stock log write failed:", err?.message || err);
  }
}

export async function maybeNotifyLowStock({
  product,
  plan = null,
  planLabel = "",
  stockBefore,
  stockAfter,
}) {
  const threshold = alertThreshold();
  if (!Number.isFinite(Number(stockAfter))) return;
  if (Number(stockAfter) > threshold) return;

  // Notify when crossing into the low zone, and always at zero.
  if (Number(stockAfter) !== 0 && Number(stockBefore) <= threshold) return;

  try {
    await sendAdminStockAlert({
      productName: product?.name || "Product",
      planLabel: planLabel || planDisplayLabel(plan, ""),
      stock: Number(stockAfter),
      productId: String(product?._id || ""),
      planId: String(plan?._id || ""),
    });
  } catch (err) {
    console.error("Low stock Discord alert failed:", err?.message || err);
  }
}

/**
 * Reserve units for a new order. Limited products use one atomic
 * findOneAndUpdate with a stock >= quantity guard, so two buyers can never
 * reserve the same last unit. Unlimited products never decrement.
 */
export async function reserveStock({
  product,
  plan = null,
  quantity = 1,
  orderId = null,
  planLabel = "",
}) {
  if (!product?._id) {
    return { ok: false, reason: "product_missing" };
  }

  const qty = quantityOf(quantity);
  const info = getPlanStockInfo(product, plan);

  if (!info.inStock) {
    return {
      ok: false,
      reason: "out_of_stock",
      message: "Product is currently out of stock.",
    };
  }

  const scope = plan ? "plan" : "product";
  const label = planLabel || planDisplayLabel(plan, "");
  const snapshot = {
    productId: String(product._id),
    mode: info.mode,
    scope,
    planId: plan?._id ? String(plan._id) : "",
    planLabel: label,
    quantity: qty,
  };

  if (!info.limited) {
    return { ok: true, reserved: false, snapshot, stockAfter: null };
  }

  const selector = plan ? planSelector(plan) : null;

  if (plan && !selector) {
    return { ok: false, reason: "plan_missing" };
  }

  const filter = plan
    ? {
        _id: product._id,
        outOfStock: { $ne: true },
        plans: {
          $elemMatch: {
            ...selector,
            ...stockModeElemFilter(plan, product),
            outOfStock: { $ne: true },
            stock: { $gte: qty },
          },
        },
      }
    : {
        _id: product._id,
        stockMode: "limited",
        outOfStock: { $ne: true },
        stock: { $gte: qty },
      };

  const update = plan
    ? { $inc: { "plans.$.stock": -qty, "plans.$.reserved": qty } }
    : { $inc: { stock: -qty, reserved: qty } };

  const updated = await Product.findOneAndUpdate(filter, update, {
    new: true,
  }).lean();

  if (!updated) {
    return {
      ok: false,
      reason: "out_of_stock",
      message: "Product is currently out of stock.",
    };
  }

  const updatedPlan = plan ? findUpdatedPlan(updated, plan) : null;
  const stockAfter = plan
    ? Math.max(0, Number(updatedPlan?.stock) || 0)
    : Math.max(0, Number(updated.stock) || 0);
  const reservedAfter = plan
    ? Math.max(0, Number(updatedPlan?.reserved) || 0)
    : Math.max(0, Number(updated.reserved) || 0);
  const stockBefore = stockAfter + qty;

  await recordStockLog({
    productId: product._id,
    productName: product.name || "",
    planId: plan?._id ? String(plan._id) : "",
    planLabel: label,
    scope,
    action: "reserve",
    quantity: qty,
    delta: -qty,
    stockBefore,
    stockAfter,
    reservedAfter,
    orderId,
    note: "Reserved for pending checkout",
  });

  await maybeNotifyLowStock({
    product,
    plan,
    planLabel: label,
    stockBefore,
    stockAfter,
  });

  return { ok: true, reserved: true, snapshot, stockAfter };
}

async function releaseStockSnapshot(snapshot, orderId = null, reason = "") {
  if (!snapshot || snapshot.mode !== "limited") return { ok: true };

  const productId = snapshot.productId;
  const qty = quantityOf(snapshot.quantity);
  if (!isObjectId(productId)) return { ok: false, reason: "product_missing" };

  const selector = planSelector(snapshot);
  let updated = null;

  if (snapshot.scope === "plan" && selector) {
    updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        plans: {
          $elemMatch: { ...selector, reserved: { $gte: qty } },
        },
      },
      { $inc: { "plans.$.stock": qty, "plans.$.reserved": -qty } },
      { new: true }
    ).lean();

    if (!updated) {
      updated = await Product.findOneAndUpdate(
        {
          _id: productId,
          plans: { $elemMatch: selector },
        },
        { $inc: { "plans.$.stock": qty } },
        { new: true }
      ).lean();
    }
  } else {
    updated = await Product.findOneAndUpdate(
      { _id: productId, reserved: { $gte: qty } },
      { $inc: { stock: qty, reserved: -qty } },
      { new: true }
    ).lean();

    if (!updated) {
      updated = await Product.findOneAndUpdate(
        { _id: productId },
        { $inc: { stock: qty } },
        { new: true }
      ).lean();
    }
  }

  if (!updated) {
    return { ok: false, reason: "product_missing" };
  }

  const updatedPlan =
    snapshot.scope === "plan" ? findUpdatedPlan(updated, snapshot) : null;
  const stockAfter =
    snapshot.scope === "plan"
      ? Math.max(0, Number(updatedPlan?.stock) || 0)
      : Math.max(0, Number(updated.stock) || 0);
  const reservedAfter =
    snapshot.scope === "plan"
      ? Math.max(0, Number(updatedPlan?.reserved) || 0)
      : Math.max(0, Number(updated.reserved) || 0);

  await recordStockLog({
    productId,
    productName: updated.name || "",
    planId: String(snapshot.planId || ""),
    planLabel: String(snapshot.planLabel || ""),
    scope: snapshot.scope === "plan" ? "plan" : "product",
    action: "release",
    quantity: qty,
    delta: qty,
    stockBefore: Math.max(0, stockAfter - qty),
    stockAfter,
    reservedAfter,
    orderId,
    note: reason || "Reservation released",
  });

  return { ok: true };
}

async function decrementReservedCounter(snapshot, orderId = null) {
  if (!snapshot || snapshot.mode !== "limited") return { ok: true };

  const productId = snapshot.productId;
  const qty = quantityOf(snapshot.quantity);
  if (!isObjectId(productId)) return { ok: false };

  const selector = planSelector(snapshot);
  let updated = null;

  if (snapshot.scope === "plan" && selector) {
    updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        plans: {
          $elemMatch: { ...selector, reserved: { $gte: qty } },
        },
      },
      { $inc: { "plans.$.reserved": -qty } },
      { new: true }
    ).lean();
  } else {
    updated = await Product.findOneAndUpdate(
      { _id: productId, reserved: { $gte: qty } },
      { $inc: { reserved: -qty } },
      { new: true }
    ).lean();
  }

  if (!updated) {
    await recordStockLog({
      productId,
      planId: String(snapshot.planId || ""),
      planLabel: String(snapshot.planLabel || ""),
      scope: snapshot.scope === "plan" ? "plan" : "product",
      action: "confirm",
      quantity: qty,
      delta: 0,
      orderId,
      note: "Reserved counter was already clear",
    });
    return { ok: false };
  }

  const updatedPlan =
    snapshot.scope === "plan" ? findUpdatedPlan(updated, snapshot) : null;
  const stockAfter =
    snapshot.scope === "plan"
      ? Math.max(0, Number(updatedPlan?.stock) || 0)
      : Math.max(0, Number(updated.stock) || 0);
  const reservedAfter =
    snapshot.scope === "plan"
      ? Math.max(0, Number(updatedPlan?.reserved) || 0)
      : Math.max(0, Number(updated.reserved) || 0);

  await recordStockLog({
    productId,
    productName: updated.name || "",
    planId: String(snapshot.planId || ""),
    planLabel: String(snapshot.planLabel || ""),
    scope: snapshot.scope === "plan" ? "plan" : "product",
    action: "confirm",
    quantity: qty,
    delta: 0,
    stockBefore: stockAfter,
    stockAfter,
    reservedAfter,
    orderId,
    note: "Payment verified; reserved unit sold",
  });

  return { ok: true };
}

/**
 * Called before an order is marked paid. Confirms an existing reservation,
 * or re-acquires stock if it was released after expiry. Returns ok:false
 * instead of letting an oversold order through.
 */
export async function ensureStockForPayment(orderIdOrDoc) {
  await connectDB();

  const id = String(orderIdOrDoc?._id || orderIdOrDoc || "");
  if (!isObjectId(id)) return { ok: false, reason: "invalid_order_id" };

  const order = await Order.findById(id).lean();
  if (!order) return { ok: false, reason: "not_found" };
  if (order.stockCommitted) return { ok: true, alreadyCommitted: true };

  const snapshot = order.stockReservation || null;
  const limited = snapshot?.mode === "limited";

  if (order.stockReserved) {
    const locked = await Order.findOneAndUpdate(
      {
        _id: id,
        stockReserved: true,
        stockCommitted: { $ne: true },
      },
      {
        $set: {
          stockReserved: false,
          stockCommitted: true,
          stockError: "",
        },
      },
      { new: true }
    ).lean();

    if (locked) {
      if (limited) {
        await decrementReservedCounter(
          locked.stockReservation || snapshot,
          id
        );
      }
      return { ok: true, committed: true, order: locked };
    }

    const latest = await Order.findById(id).lean();
    if (latest?.stockCommitted) return { ok: true, alreadyCommitted: true };
    return { ok: false, reason: "reservation_conflict" };
  }

  if (!limited) {
    await Order.updateOne(
      { _id: id, stockCommitted: { $ne: true } },
      { $set: { stockCommitted: true } }
    );
    return { ok: true };
  }

  const product = await Product.findById(order.productId || order.product).lean();
  if (!product) {
    await Order.updateOne(
      { _id: id },
      { $set: { stockError: "Product no longer exists" } }
    );
    return { ok: false, reason: "product_missing" };
  }

  const plan =
    snapshot?.scope === "plan" ? findProductPlan(product, order) : null;

  const acquired = await reserveStock({
    product,
    plan,
    quantity: order.quantity || 1,
    orderId: id,
    planLabel: snapshot?.planLabel || "",
  });

  if (!acquired.ok) {
    await Order.updateOne(
      { _id: id },
      { $set: { stockError: acquired.reason || "out_of_stock" } }
    );
    return { ok: false, reason: acquired.reason || "out_of_stock" };
  }

  const locked = await Order.findOneAndUpdate(
    { _id: id, stockCommitted: { $ne: true } },
    {
      $set: {
        stockReserved: false,
        stockCommitted: true,
        stockReleased: false,
        stockReservation: acquired.snapshot,
        stockReservationExpiresAt: null,
        stockError: "",
      },
    },
    { new: true }
  ).lean();

  if (!locked) {
    await releaseStockSnapshot(acquired.snapshot, id, "commit_race");
    return { ok: true, alreadyCommitted: true };
  }

  if (acquired.reserved) {
    await decrementReservedCounter(acquired.snapshot, id);
  }

  return { ok: true, committed: true, order: locked };
}

/** Release held units exactly once (expired/cancelled/deleted order). */
export async function releaseProductStockReservation(
  orderIdOrDoc,
  reason = "reservation_released"
) {
  await connectDB();

  const id = String(orderIdOrDoc?._id || orderIdOrDoc || "");
  if (!isObjectId(id)) return { ok: false, released: false };

  const locked = await Order.findOneAndUpdate(
    {
      _id: id,
      stockReserved: true,
      stockCommitted: { $ne: true },
      stockReleased: { $ne: true },
    },
    {
      $set: {
        stockReserved: false,
        stockReleased: true,
        stockReservationExpiresAt: null,
      },
    },
    { new: true }
  ).lean();

  if (!locked) return { ok: false, released: false };

  if (locked.stockReservation?.mode === "limited") {
    await releaseStockSnapshot(locked.stockReservation, id, reason);
  }

  return { ok: true, released: true };
}

/** Roll back a reservation that never made it into an Order document. */
export async function releaseStockReservationSnapshot(
  snapshot,
  orderId = null,
  reason = "order_create_failed"
) {
  await connectDB();
  return releaseStockSnapshot(snapshot, orderId, reason);
}

/** Release every reservation whose order expired/cancelled or 15m passed. */
export async function releaseExpiredStockReservations({ limit = 50 } = {}) {
  await connectDB();

  const now = new Date();
  const cutoff = new Date(now.getTime() - STOCK_RESERVATION_TTL_MS);
  const orders = await Order.find({
    stockReserved: true,
    stockCommitted: { $ne: true },
    stockReleased: { $ne: true },
    $or: [
      { status: "cancelled" },
      { status: "expired" },
      { stockReservationExpiresAt: { $lte: now } },
      {
        stockReservationExpiresAt: null,
        createdAt: { $lte: cutoff },
      },
    ],
  })
    .limit(Math.max(1, Math.min(200, Number(limit) || 50)))
    .lean();

  let released = 0;
  for (const order of orders) {
    const result = await releaseProductStockReservation(
      order,
      "reservation_expired"
    );
    if (result.released) released += 1;
  }

  return released;
}

/** Throttled lazy sweep so public product pages keep counts fresh. */
export async function maybeReleaseExpiredStockReservations() {
  if (Date.now() - lastAutoReleaseAt < 60 * 1000) return 0;
  lastAutoReleaseAt = Date.now();
  try {
    return await releaseExpiredStockReservations({ limit: 50 });
  } catch (err) {
    console.error("Stock reservation sweep failed:", err?.message || err);
    return 0;
  }
}

/** Admin-only list of recent stock movements. */
export async function getStockLogs({ productId = "", limit = 200 } = {}) {
  await connectDB();
  const filter = {};
  if (isObjectId(productId)) filter.productId = productId;
  return StockLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(500, Number(limit) || 200)))
    .lean();
}

export async function countAvailableStockItems(productId) {
  if (!productId) return 0;
  return ProductStockItem.countDocuments({
    productId,
    claimedOrderId: null,
  });
}

export async function stockItemCountsFor(productIds) {
  const ids = [...new Set(asList(productIds).map(String).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const objectIds = ids
    .filter((id) => /^[a-f\d]{24}$/i.test(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (objectIds.length === 0) return new Map();

  const rows = await ProductStockItem.aggregate([
    {
      $match: {
        productId: { $in: objectIds },
        claimedOrderId: null,
      },
    },
    { $group: { _id: "$productId", count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), Number(row.count) || 0]));
}

/**
 * Public catalog/detail documents show the number of unclaimed items as their
 * stock count when stock mode is enabled.
 */
export async function attachStockAvailability(products) {
  const list = asList(products);
  const stockProductIds = list
    .filter((product) => {
      if (!product?.useStockItems) return false;
      const plans = Array.isArray(product.plans) ? product.plans : [];
      if (plans.length > 0) {
        return !plans.some(
          (plan) =>
            normalizeStockMode(plan.stockMode, product.stockMode) === "limited"
        );
      }
      return normalizeStockMode(product.stockMode) !== "limited";
    })
    .map((product) => product?._id)
    .filter(Boolean);

  if (stockProductIds.length === 0) return products;

  const counts = await stockItemCountsFor(stockProductIds);
  const updated = list.map((product) => {
    if (!stockProductIds.some((id) => String(id) === String(product?._id))) {
      return product;
    }
    return {
      ...product,
      stock: counts.get(String(product._id)) || 0,
      stockFromItems: true,
    };
  });

  return Array.isArray(products) ? updated : updated[0];
}

/** Admin-only data: unclaimed values for editing + a display count. */
export async function attachAdminStockData(products) {
  const list = asList(products);
  const stockProductIds = list
    .filter((product) => product?.useStockItems)
    .map((product) => product?._id)
    .filter(Boolean);

  if (stockProductIds.length === 0) {
    return Array.isArray(products)
      ? list.map((product) => ({ ...product, stockItemCount: 0, stockItems: [] }))
      : { ...list[0], stockItemCount: 0, stockItems: [] };
  }

  const docs = await ProductStockItem.find({
    productId: { $in: stockProductIds },
    claimedOrderId: null,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const valuesByProduct = new Map();
  for (const doc of docs) {
    const key = String(doc.productId);
    if (!valuesByProduct.has(key)) valuesByProduct.set(key, []);
    valuesByProduct.get(key).push(doc.value);
  }

  const updated = list.map((product) => {
    const values = valuesByProduct.get(String(product?._id)) || [];
    return {
      ...product,
      stockItemCount: values.length,
      stockItems: values,
    };
  });

  return Array.isArray(products) ? updated : updated[0];
}

/** Replace only unclaimed items; already-delivered values are never touched. */
export async function replaceUnclaimedStockItems(productId, items = []) {
  await ProductStockItem.deleteMany({
    productId,
    claimedOrderId: null,
  });

  if (Array.isArray(items) && items.length > 0) {
    await ProductStockItem.insertMany(
      items.map((value) => ({ productId, value })),
      { ordered: true }
    );
  }
}

/** Atomically claim one unclaimed item for an order. */
export async function claimProductStockItem(productId, orderId) {
  const alreadyClaimed = await ProductStockItem.findOne({
    productId,
    claimedOrderId: orderId,
  }).lean();
  if (alreadyClaimed) return alreadyClaimed;

  return ProductStockItem.findOneAndUpdate(
    { productId, claimedOrderId: null },
    {
      $set: {
        claimedOrderId: orderId,
        claimedAt: new Date(),
      },
    },
    { new: true, sort: { createdAt: 1, _id: 1 } }
  ).lean();
}

/** Return an item to the pool (used when an order fails or is deleted). */
export async function releaseProductStockItem(orderId) {
  if (!orderId) return;
  await ProductStockItem.updateMany(
    { claimedOrderId: orderId },
    { $set: { claimedOrderId: null, claimedAt: null } }
  );
}
