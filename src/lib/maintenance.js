import connectDB from "@/lib/db";
import Category from "@/models/Category";
import MaintenanceLog from "@/models/MaintenanceLog";

/**
 * Pure helper function to determine if a product is in maintenance mode.
 * Safe to call on both client and server.
 *
 * Precedence:
 * 1. Product's own maintenance flag (source: "product")
 * 2. Category's maintenance flag (source: "category")
 *
 * @param {Object} product - Product object with optional maintenance & maintenanceReason
 * @param {Object|null} category - Category document/object with optional maintenance fields
 * @returns {Object} { inMaintenance: boolean, reason: string, source: "product"|"category"|null, maintenanceUntil: string|null, maintenanceSince: Date|null }
 */
export function isProductInMaintenance(product, category = null) {
  if (product && product.maintenance === true) {
    return {
      inMaintenance: true,
      reason:
        product.maintenanceReason ||
        "This product is temporarily under maintenance. Please check back later.",
      source: "product",
      maintenanceUntil: null,
      maintenanceSince: null,
    };
  }

  if (category && category.maintenance === true) {
    return {
      inMaintenance: true,
      reason:
        category.maintenanceReason ||
        "This category is temporarily under maintenance. Please check back later.",
      source: "category",
      maintenanceUntil: category.maintenanceUntil || null,
      maintenanceSince: category.maintenanceSince || null,
    };
  }

  return {
    inMaintenance: false,
    reason: "",
    source: null,
    maintenanceUntil: null,
    maintenanceSince: null,
  };
}

/**
 * Server-only helper: Returns a map of category names (normalized to lower-case)
 * to their Category maintenance records.
 */
export async function getCategoryMaintenanceMap() {
  try {
    await connectDB();
    const categories = await Category.find().lean();
    const map = new Map();
    for (const cat of categories) {
      if (cat.name) {
        map.set(String(cat.name).trim().toLowerCase(), {
          _id: String(cat._id),
          name: cat.name,
          maintenance: Boolean(cat.maintenance),
          maintenanceReason: cat.maintenanceReason || "",
          maintenanceUntil: cat.maintenanceUntil || "",
          maintenanceSince: cat.maintenanceSince || null,
        });
      }
    }
    return map;
  } catch (err) {
    console.error("Failed to load category maintenance map:", err?.message || err);
    return new Map();
  }
}

/**
 * Server-only helper: Returns list of categories that are currently under maintenance.
 */
export async function getActiveMaintenanceCategories() {
  try {
    await connectDB();
    const categories = await Category.find({ maintenance: true }).lean();
    return JSON.parse(JSON.stringify(categories));
  } catch (err) {
    console.error("Failed to load active maintenance categories:", err?.message || err);
    return [];
  }
}

/**
 * Server-only helper: Resolves the effective maintenance state for a single product
 * by looking up its category from the database if category is not already provided.
 */
export async function resolveProductMaintenance(product, categoryMap = null) {
  if (!product) return isProductInMaintenance(null, null);

  // If product itself is marked maintenance, we don't need category lookup
  if (product.maintenance === true) {
    return isProductInMaintenance(product, null);
  }

  const categoryName = String(product.category || "").trim().toLowerCase();
  if (!categoryName) {
    return isProductInMaintenance(product, null);
  }

  if (categoryMap && categoryMap.has(categoryName)) {
    return isProductInMaintenance(product, categoryMap.get(categoryName));
  }

  try {
    await connectDB();
    const categoryDoc = await Category.findOne({
      name: { $regex: new RegExp(`^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    }).lean();
    return isProductInMaintenance(product, categoryDoc);
  } catch (err) {
    console.error("Failed to resolve category for product maintenance:", err?.message || err);
    return isProductInMaintenance(product, null);
  }
}

/**
 * Enriches a product plain object with unified maintenance fields.
 */
export function attachMaintenanceFields(product, categoryMap = null) {
  if (!product) return product;

  let categoryObj = null;
  const catName = String(product.category || "").trim().toLowerCase();
  if (categoryMap && catName && categoryMap.has(catName)) {
    categoryObj = categoryMap.get(catName);
  }

  const status = isProductInMaintenance(product, categoryObj);
  return {
    ...product,
    inMaintenance: status.inMaintenance,
    maintenanceReason: status.reason,
    maintenanceSource: status.source,
    maintenanceUntil: status.maintenanceUntil,
    maintenanceSince: status.maintenanceSince,
  };
}

/**
 * Log a maintenance mode action into the audit trail.
 */
export async function logMaintenanceAction({
  adminId = "",
  adminEmail = "",
  targetType,
  targetId = "",
  targetName = "",
  action,
  reason = "",
  maintenanceUntil = "",
  productCount = 1,
  details = null,
}) {
  try {
    await connectDB();
    return await MaintenanceLog.create({
      adminId,
      adminEmail,
      targetType,
      targetId,
      targetName,
      action,
      reason,
      maintenanceUntil,
      productCount,
      details,
    });
  } catch (err) {
    console.error("Failed to write maintenance log:", err?.message || err);
    return null;
  }
}

