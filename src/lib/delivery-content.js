/**
 * Delivery content helpers shared by server APIs and client components.
 *
 * These functions are intentionally pure: no database access and no secrets.
 * Product/order documents are only stripped of delivery fields here when they
 * are about to cross a public/client boundary.
 */

export const DELIVERY_TYPES = ["license", "content"];

export const DELIVERY_LIMITS = {
  title: 200,
  link: 2000,
  message: 5000,
  buttonLabel: 80,
  stockItem: 5000,
};

const DELIVERY_FIELDS = [
  "deliveryTitle",
  "deliveryLink",
  "deliveryMessage",
  "deliveryButtonLabel",
];

export function normalizeDeliveryType(value) {
  return String(value || "").trim().toLowerCase() === "content"
    ? "content"
    : "license";
}

export function isContentDelivery(value) {
  return normalizeDeliveryType(value) === "content";
}

/** Return a valid absolute http(s) link, or an empty string. */
export function normalizeDeliveryLink(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.length > DELIVERY_LIMITS.link) return "";

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return raw;
  } catch {
    return "";
  }
}

export function isValidDeliveryLink(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return true;
  return normalizeDeliveryLink(raw) !== "";
}

function readField(input, names) {
  for (const name of names) {
    if (input && input[name] !== undefined && input[name] !== null) {
      return input[name];
    }
  }
  return "";
}

function limitedText(value, max) {
  const text = String(value ?? "").trim();
  return text.length > max ? "" : text;
}

/**
 * Validate/sanitize admin delivery-content input.
 * Accepts both product field names and the shorter admin-edit names.
 */
export function sanitizeDeliveryContentInput(input) {
  const titleRaw = readField(input, ["deliveryTitle", "title"]);
  const linkRaw = readField(input, ["deliveryLink", "link"]);
  const messageRaw = readField(input, ["deliveryMessage", "message"]);
  const buttonLabelRaw = readField(input, [
    "deliveryButtonLabel",
    "buttonLabel",
  ]);

  const link = String(linkRaw ?? "").trim();
  if (!isValidDeliveryLink(link)) {
    return {
      ok: false,
      error: "Delivery link must be a valid http:// or https:// URL.",
    };
  }

  const title = limitedText(titleRaw, DELIVERY_LIMITS.title);
  if (String(titleRaw ?? "").trim().length > DELIVERY_LIMITS.title) {
    return {
      ok: false,
      error: `Delivery title must be ${DELIVERY_LIMITS.title} characters or less.`,
    };
  }

  const message = limitedText(messageRaw, DELIVERY_LIMITS.message);
  if (String(messageRaw ?? "").trim().length > DELIVERY_LIMITS.message) {
    return {
      ok: false,
      error: `Delivery message must be ${DELIVERY_LIMITS.message} characters or less.`,
    };
  }

  const buttonLabel = limitedText(buttonLabelRaw, DELIVERY_LIMITS.buttonLabel);
  if (
    String(buttonLabelRaw ?? "").trim().length > DELIVERY_LIMITS.buttonLabel
  ) {
    return {
      ok: false,
      error: `Button label must be ${DELIVERY_LIMITS.buttonLabel} characters or less.`,
    };
  }

  const value = {
    deliveryTitle: title,
    deliveryLink: normalizeDeliveryLink(link),
    deliveryMessage: message,
    deliveryButtonLabel: buttonLabel,
  };

  return {
    ok: true,
    value,
    hasDeliveryBody: Boolean(value.deliveryLink || value.deliveryMessage),
  };
}

/** Parse admin "one item per line" stock input into unique values. */
export function parseStockItemsInput(input) {
  const rawValues = Array.isArray(input)
    ? input
    : String(input ?? "").split(/\r?\n/);

  const items = [];
  const seen = new Set();

  for (const raw of rawValues) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    if (value.length > DELIVERY_LIMITS.stockItem) {
      return {
        ok: false,
        error: `Each stock item must be ${DELIVERY_LIMITS.stockItem} characters or less.`,
      };
    }
    if (seen.has(value)) continue;
    if (items.length >= 500) {
      return { ok: false, error: "A product can have at most 500 stock items." };
    }
    seen.add(value);
    items.push(value);
  }

  return { ok: true, items };
}

/** Find the product plan snapshot referenced by an order. */
export function findProductPlan(product, order) {
  const plans = Array.isArray(product?.plans) ? product.plans : [];
  if (plans.length === 0) return null;

  const planId = String(order?.planId || "").trim();
  if (planId) {
    const match = plans.find(
      (plan) =>
        String(plan?._id || "") === planId ||
        String(plan?.label || "").trim().toLowerCase() === planId.toLowerCase()
    );
    if (match) return match;
  }

  const label = String(order?.plan?.label || "").trim().toLowerCase();
  if (label) {
    const match = plans.find(
      (plan) => String(plan?.label || "").trim().toLowerCase() === label
    );
    if (match) return match;
  }

  const days = order?.plan?.days;
  if (days !== undefined && days !== null && days !== "") {
    const match = plans.find((plan) => Number(plan?.days) === Number(days));
    if (match) return match;
  }

  return null;
}

/**
 * Resolve plan-level content with field-by-field fallback to the product
 * default. Returns a normalized snapshot ready to store on the order.
 */
export function resolveDeliveryContent(product, plan = null, order = null) {
  const choose = (field) => {
    const planValue = plan?.[field];
    if (typeof planValue === "string" && planValue.trim()) return planValue;
    const productValue = product?.[field];
    return typeof productValue === "string" ? productValue : "";
  };

  const link = normalizeDeliveryLink(choose("deliveryLink"));
  const message = String(choose("deliveryMessage") || "").trim().slice(
    0,
    DELIVERY_LIMITS.message
  );
  const title =
    String(choose("deliveryTitle") || "").trim().slice(0, DELIVERY_LIMITS.title) ||
    String(order?.productName || product?.name || "Your order is ready");

  const buttonLabel =
    String(choose("deliveryButtonLabel") || "").trim().slice(
      0,
      DELIVERY_LIMITS.buttonLabel
    ) || (link ? "Open Link" : "");

  if (!link && !message) {
    return { ok: false, reason: "missing_delivery_content" };
  }

  return {
    ok: true,
    content: {
      title,
      link,
      message,
      buttonLabel,
      stockItem: "",
    },
  };
}

/** Remove delivery fields from a product before it reaches a public client. */
export function stripProductDeliveryFields(product) {
  if (!product || typeof product !== "object") return product;

  const safe = { ...product };
  for (const field of DELIVERY_FIELDS) delete safe[field];
  delete safe.useStockItems;
  delete safe.stockItems;
  delete safe.stockItemCount;
  delete safe.reserved;

  if (Array.isArray(safe.plans)) {
    safe.plans = safe.plans.map((plan) => {
      if (!plan || typeof plan !== "object") return plan;
      const copy = { ...plan };
      for (const field of DELIVERY_FIELDS) delete copy[field];
      delete copy.reserved;
      return copy;
    });
  }

  return safe;
}

export default resolveDeliveryContent;
