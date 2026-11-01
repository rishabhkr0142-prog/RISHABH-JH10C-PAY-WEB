import Order from "@/models/Order";

/**
 * Server-only helpers for the Mani auth panel license API.
 *
 * IMPORTANT:
 * - MANI_API_KEY must never be imported into client code or logged.
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
 * Convert an order plan (or raw day count) into the duration_days value
 * expected by the auth panel. `0` means Lifetime in this project.
 */
export function durationDaysFromPlan(plan, fallbackDays = 0) {
  const raw =
    plan && typeof plan === "object"
      ? plan.days ?? plan.duration_days ?? plan.durationDays
      : plan;

  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0) {
    const fallback = Number(fallbackDays);
    if (Number.isFinite(fallback) && fallback > 0) return Math.round(fallback);
    return DEFAULT_DAYS;
  }

  // Lifetime plan (0 days) gets a very large duration.
  if (numeric === 0) return LIFETIME_DAYS;

  return Math.max(1, Math.round(numeric));
}

/**
 * Resolve duration_days for an order id (planId), an order document,
 * or a plain plan object / number.
 */
export async function resolveDurationDays(planOrOrder) {
  if (planOrOrder && typeof planOrOrder === "object") {
    if (planOrOrder.plan || planOrOrder.planId) {
      return durationDaysFromPlan(planOrOrder.plan);
    }
    return durationDaysFromPlan(planOrOrder);
  }

  const value = String(planOrOrder ?? "").trim();

  if (!value) return DEFAULT_DAYS;

  // Raw day count (e.g. "30")
  if (/^\d+$/.test(value)) {
    return durationDaysFromPlan(Number(value));
  }

  // planId is usually the order ObjectId — look up its plan snapshot.
  if (/^[a-f\d]{24}$/i.test(value)) {
    const order = await Order.findById(value).select("plan planId").lean();
    if (order) return durationDaysFromPlan(order.plan);
  }

  return DEFAULT_DAYS;
}

/** Recursively look for a key-like field in an API response. */
function extractKey(payload) {
  const preferred = [
    "key",
    "license",
    "license_key",
    "licenseKey",
    "license_code",
    "licenseCode",
  ];

  const queue = [{ value: payload, depth: 0 }];
  const seen = new Set();

  while (queue.length > 0) {
    const { value, depth } = queue.shift();
    if (!value || depth > 4) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }

    if (typeof value !== "object") continue;
    if (seen.has(value)) continue;
    seen.add(value);

    for (const field of preferred) {
      const candidate = value[field];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    for (const nested of Object.values(value)) {
      if (nested && typeof nested === "object") {
        queue.push({ value: nested, depth: depth + 1 });
      }
    }
  }

  return "";
}

/**
 * Generate a single license key for an order.
 *
 * @param {object|string} planOrOrder - Order document, plan object or planId
 * @returns {Promise<string>} the generated license key
 */
export async function generateKey(planOrOrder) {
  const apiKey = process.env.MANI_API_KEY;
  const appId = process.env.MANI_APP_ID;

  if (!apiKey) {
    throw new Error("MANI_API_KEY is not configured on the server.");
  }
  if (!appId) {
    throw new Error("MANI_APP_ID is not configured on the server.");
  }

  const durationDays = await resolveDurationDays(planOrOrder);

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
