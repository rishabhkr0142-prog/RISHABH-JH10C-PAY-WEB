/**
 * Shared inventory helpers (safe for both server and client bundles).
 *
 * A product/plan is one of:
 *   - unlimited: stock never decreases. Can still be manually disabled.
 *   - limited:   `stock` is the number of units currently available.
 *
 * `reserved` units are already removed from `stock` while an unpaid order
 * holds them. Public UI only needs the mode/stock/outOfStock fields.
 */

export const STOCK_MODES = ["unlimited", "limited"];

/** Show "Only X left" at or below this number. */
export const LOW_STOCK_DISPLAY_THRESHOLD = 5;

/** Default admin alert threshold (override with LOW_STOCK_ALERT_THRESHOLD). */
export const DEFAULT_LOW_STOCK_ALERT_THRESHOLD = 3;

export function normalizeStockMode(value, fallback = "unlimited") {
  const mode = String(value ?? "")
    .trim()
    .toLowerCase();
  return STOCK_MODES.includes(mode) ? mode : fallback;
}

export function toStockNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return Math.max(0, fallback);
  return Math.max(0, Math.floor(num));
}

export function planDisplayLabel(plan, fallback = "") {
  const label = String(plan?.label || "").trim();
  if (label) return label;
  const days = Number(plan?.days) || 0;
  if (days > 0) return `${days} Day${days === 1 ? "" : "s"}`;
  return fallback || "Lifetime";
}

/**
 * Resolve the effective inventory state for one plan, or for the product
 * itself when `plan` is null. A product-level out-of-stock switch always wins.
 */
export function getPlanStockInfo(product, plan = null) {
  const fallbackMode = normalizeStockMode(product?.stockMode, "unlimited");
  const rawMode = normalizeStockMode(plan?.stockMode, fallbackMode);

  // Legacy unique stock-item pools are exposed as a limited product-level
  // count on public pages. Plans with their own "limited" mode win.
  const poolBacked = Boolean(
    product?.stockFromItems && (!plan || rawMode !== "limited")
  );
  const mode = poolBacked ? "limited" : rawMode;
  const limited = mode === "limited";
  const stock = limited
    ? toStockNumber(
        poolBacked ? product?.stock : plan ? plan.stock : product?.stock,
        0
      )
    : null;
  const outOfStock = Boolean(product?.outOfStock || plan?.outOfStock);
  const inStock = !outOfStock && (!limited || stock > 0);

  return {
    mode,
    limited,
    unlimited: !limited,
    stock,
    outOfStock,
    inStock,
    reserved:
      limited && !poolBacked
        ? toStockNumber(plan ? plan.reserved : product?.reserved, 0)
        : 0,
    planLabel: plan ? planDisplayLabel(plan) : "",
  };
}

/**
 * Aggregate display state for a product card/list. When plans exist, the
 * product is in stock if at least one plan is purchasable.
 */
export function getProductStockInfo(product) {
  const plans = Array.isArray(product?.plans) ? product.plans : [];

  if (plans.length === 0) {
    const info = getPlanStockInfo(product, null);
    return {
      ...info,
      hasPlans: false,
      availablePlans: info.inStock ? 1 : 0,
      totalLimitedStock: info.limited ? info.stock : null,
      lowStock:
        info.inStock &&
        info.limited &&
        info.stock !== null &&
        info.stock > 0 &&
        info.stock <= LOW_STOCK_DISPLAY_THRESHOLD,
    };
  }

  const infos = plans.map((plan) => getPlanStockInfo(product, plan));
  const available = infos.filter((info) => info.inStock);
  const inStock = available.length > 0;

  const allLimited = infos.every((info) => info.limited);
  const anyUnlimitedAvailable = available.some((info) => info.unlimited);
  const limitedAvailable = available.filter((info) => info.limited);
  const totalLimitedStock = infos
    .filter((info) => info.limited)
    .reduce((sum, info) => sum + (info.stock || 0), 0);

  const displayStock = anyUnlimitedAvailable
    ? null
    : inStock
    ? Math.min(...limitedAvailable.map((info) => info.stock))
    : 0;

  const limited = allLimited;
  const lowStock =
    inStock &&
    !anyUnlimitedAvailable &&
    limited &&
    displayStock !== null &&
    displayStock > 0 &&
    displayStock <= LOW_STOCK_DISPLAY_THRESHOLD;

  return {
    mode: limited ? "limited" : "unlimited",
    limited,
    unlimited: !limited,
    stock: limited ? displayStock : null,
    outOfStock: !inStock,
    inStock,
    reserved: infos.reduce((sum, info) => sum + (info.reserved || 0), 0),
    hasPlans: true,
    availablePlans: available.length,
    totalLimitedStock,
    lowStock,
  };
}

/** Small badge contract shared by the catalog and detail pages. */
export function getStockBadge(info) {
  if (!info?.inStock) {
    return { label: "Out of Stock", tone: "out" };
  }

  if (
    info.limited &&
    info.stock !== null &&
    info.stock !== undefined &&
    info.stock <= LOW_STOCK_DISPLAY_THRESHOLD
  ) {
    return { label: `Only ${info.stock} left`, tone: "low" };
  }

  return { label: "In Stock", tone: "in" };
}

/** Pick the cheapest plan that can currently be purchased. */
export function pickDefaultPlan(product) {
  const plans = Array.isArray(product?.plans) ? product.plans : [];
  if (plans.length === 0) return null;

  const sorted = [...plans].sort(
    (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0)
  );
  return (
    sorted.find((plan) => getPlanStockInfo(product, plan).inStock) || sorted[0]
  );
}
