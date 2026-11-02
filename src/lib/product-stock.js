import mongoose from "mongoose";
import ProductStockItem from "@/models/ProductStockItem";

/**
 * Server-only helpers for the optional unique stock-item pool.
 * Public product documents never include individual item values.
 */

function asList(value) {
  return Array.isArray(value) ? value : [value].filter(Boolean);
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
    .filter((product) => product?.useStockItems)
    .map((product) => product?._id)
    .filter(Boolean);

  if (stockProductIds.length === 0) return products;

  const counts = await stockItemCountsFor(stockProductIds);
  const updated = list.map((product) => {
    if (!product?.useStockItems) return product;
    return {
      ...product,
      stock: counts.get(String(product._id)) || 0,
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
