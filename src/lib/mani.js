import Order from "@/models/Order";
import Product from "@/models/Product";
import { normalizeProductKey } from "@/lib/product-keys";

/**
 * Server-only helpers for the Mani auth panel license API.
 *
 * IMPORTANT:
 * - MANI_API_KEY and the app ids must never be imported into client code or logged.
 * - Each store product maps to its own auth-panel app id, so a LIB Bypass order
 *   can never receive a key generated for the UID Bypass app.
 * - Only license generation is supported here. The users/add and
 *   users/reset-hwid endpoints are intentionally NOT implemented,
 *   because every key is bound to a single device (no HWID reset).
 */

const AUTH_API_BASE = "https://auth.mani272api.xyz";
const API_PREFIX = "M272";
const LIFETIME_DAYS = 3650;
const DEFAULT_DAYS = 30;
const REQUEST_TIMEOUT_MS = 20000;

/**
 * Product key -> auth panel application id.
 * Add a new license product here (plus its key in src/lib/product-keys.js).
 */
export const APP_IDS = {
  uid: process.env.MANI_APP_ID_UID,
  lib: process.env.MANI_APP_ID_LIB,
};

/**
 * Resolve the auth-panel app id for a product key.
 * Throws instead of silently falling back to some default app.
 */
export function getAppId(productKey) {
  const key = normalizeProductKey(productKey);

  if (!key) {
    throw new Error(
      `Missing or unknown product key "${String(productKey || "").trim()}".`
    );
  }

  const appId = APP_IDS[key];
  if (!appId || !String(appId).trim()) {
    throw new Error(
      `Auth panel app id is not configured for product "${key}" (set MANI_APP_ID_${key.toUpperCase()}).`
    );
  }

  return String(appId).trim();
}

function normalizeDays(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  // Lifetime is stored as 0 days in this project.
  if (numeric === 0) return LIFETIME_DAYS;
  return Math.max(1, Math.round(numeric));
}

/**
 * Parse a raw day count or a human plan name into auth-panel duration_days.
 * Returns null when the value cannot be resolved.
 */
function parseDurationDays(value) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "number") return normalizeDays(value);

  const text = String(value).trim().toLowerCase();
  if (!text) return null;

  if (["lifetime", "life", "forever", "never"].includes(text)) {
    return LIFETIME_DAYS;
  }

  if (/^\d+$/.test(text)) return normalizeDays(Number(text));

  const days = text.match(/^(\d+)\s*(?:d|day|days)$/);
  if (days) return normalizeDays(Number(days[1]));

  const months = text.match(/^(\d+)\s*(?:m|mo|mon|month|months)$/);
  if (months) return normalizeDays(Number(months[1]) * 30);

  const years = text.match(/^(\d+)\s*(?:y|yr|year|years)$/);
  if (years) return normalizeDays(Number(years[1]) * 365);

  return null;
}

/**
 * Convert an order plan snapshot (or raw day count) into duration_days.
 * `0` means Lifetime in this project and maps to 3650 days.
 */
export function durationDaysFromPlan(plan, fallbackDays = null) {
  const raw =
    plan && typeof plan === "object"
      ? plan.days ?? plan.duration_days ?? plan.durationDays ?? plan.label
      : plan;

  const parsed = parseDurationDays(raw);
  if (parsed !== null) return parsed;

  const fallback = parseDurationDays(fallbackDays);
  return fallback !== null ? fallback : DEFAULT_DAYS;
}

/**
 * Resolve duration_days from a plan id.
 *
 * Supports a raw day count ("1", "30"), "lifetime", a human label
 * ("30 days"), a plan object, or the MongoDB plan id used by this project.
 */
export async function resolveDurationDays(planId, planFallback = null) {
  const fallbackDuration = durationDaysFromPlan(planFallback);

  if (planId && typeof planId === "object") {
    return durationDaysFromPlan(planId, planFallback);
  }

  const value = String(planId ?? "").trim();
  if (!value) return fallbackDuration;

  const direct = parseDurationDays(value);
  if (direct !== null) return direct;

  if (/^[a-f\d]{24}$/i.test(value)) {
    // planId in this project is the product plan subdocument id.
    const product = await Product.findOne({ "plans._id": value })
      .select("plans")
      .lean();
    const matchedPlan = product?.plans?.find(
      (plan) => String(plan._id) === value
    );
    if (matchedPlan) return durationDaysFromPlan(matchedPlan, planFallback);

    // Backward-compatible lookup for older orders that stored an order id.
    const order = await Order.findById(value).select("plan").lean();
    if (order?.plan) return durationDaysFromPlan(order.plan, planFallback);
  }

  return fallbackDuration;
}

/** Look for the license key under key / license / license_key only. */
function extractKey(payload) {
  if (!payload || typeof payload !== "object") return "";

  const fields = ["key", "license", "license_key"];
  const queue = [payload];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    for (const field of fields) {
      const candidate = current[field];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    for (const nested of Object.values(current)) {
      if (nested && typeof nested === "object") queue.push(nested);
    }
  }

  return "";
}

/**
 * Generate a single license key for an order.
 *
 * @param {string} productKey - "uid" or "lib" (from the server-side product)
 * @param {string|object} planId - plan id / duration value for the order
 * @param {object} [planFallback] - optional plan snapshot fallback
 * @returns {Promise<string>} the generated license key
 */
export async function generateKey(productKey, planId, planFallback = null) {
  const apiKey = process.env.MANI_API_KEY;
  if (!apiKey) {
    throw new Error("MANI_API_KEY is not configured on the server.");
  }

  const appId = getAppId(productKey);
  const durationDays = planId
    ? await resolveDurationDays(planId, planFallback)
    : durationDaysFromPlan(planFallback);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${AUTH_API_BASE}/api/v1/bot/licenses/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        duration_days: durationDays,
        prefix: API_PREFIX,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    const reason = err?.name === "AbortError" ? "request timed out" : "network error";
    throw new Error(`License API ${reason}. Please retry.`);
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text().catch(() => "");
  let payload = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    const apiMessage =
      (payload && typeof payload === "object" && (payload.message || payload.error)) ||
      "";
    throw new Error(
      `License API failed (HTTP ${response.status})${apiMessage ? `: ${String(apiMessage).slice(0, 160)}` : ""}`
    );
  }

  const key = extractKey(payload);
  if (!key) {
    throw new Error("License API response did not contain a license key.");
  }

  return key;
}

export default generateKey;
