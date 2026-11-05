import {
  normalizeDeliveryType,
  parseStockItemsInput,
  sanitizeDeliveryContentInput,
} from "@/lib/delivery-content";
import { normalizeStockMode, toStockNumber } from "@/lib/stock";

/** Parse duration plans, including optional plan-level delivery overrides. */
export function parseProductPlans(plans) {
  if (!Array.isArray(plans)) return { ok: true, plans: [] };

  const parsed = [];

  for (const raw of plans) {
    if (!raw || typeof raw !== "object") continue;

    const days = Math.max(0, Number(raw.days) || 0);
    const autoLabel =
      days === 0 ? "Lifetime" : `${days} Day${days > 1 ? "s" : ""}`;
    const delivery = sanitizeDeliveryContentInput(raw);

    if (!delivery.ok) return { ok: false, error: delivery.error };

    const rawId = String(raw._id || "").trim();
    const planId = /^[a-f\d]{24}$/i.test(rawId) ? rawId : undefined;

    parsed.push({
      ...(planId ? { _id: planId } : {}),
      label: String(raw.label || "").trim() || autoLabel,
      days,
      price: Math.max(0, Number(raw.price) || 0),
      // New plans default to unlimited so existing behaviour is unchanged.
      stockMode: normalizeStockMode(raw.stockMode, "unlimited"),
      stock: toStockNumber(raw.stock, 10),
      outOfStock: Boolean(raw.outOfStock),
      ...delivery.value,
    });
  }

  return { ok: true, plans: parsed };
}

/** Parse product-level inventory fields (used when a product has no plans). */
export function parseProductStockInput(input = {}) {
  return {
    stockMode: normalizeStockMode(input.stockMode, "unlimited"),
    stock: toStockNumber(input.stock, 10),
    outOfStock: Boolean(input.outOfStock),
  };
}

/** Parse product delivery type/content + optional unique stock pool input. */
export function parseProductDeliveryInput(input = {}) {
  const deliveryType = normalizeDeliveryType(input.deliveryType);
  const content = sanitizeDeliveryContentInput(input);

  if (!content.ok) return { ok: false, error: content.error };

  const useStockItems =
    deliveryType === "content" && Boolean(input.useStockItems);

  const stockItems = [];
  if (useStockItems) {
    const parsed = parseStockItemsInput(
      input.stockItems ?? input.stockItemsText ?? []
    );
    if (!parsed.ok) return { ok: false, error: parsed.error };
    stockItems.push(...parsed.items);
  }

  return {
    ok: true,
    deliveryType,
    delivery: content.value,
    hasDeliveryBody: content.hasDeliveryBody,
    useStockItems,
    stockItems,
  };
}
