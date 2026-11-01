/**
 * Pure offer helpers safe to use in both server and client components.
 * Do not import mongoose here.
 */

/** Returns "live" | "scheduled" | "expired" | "paused". */
export function getOfferStatus(offer, now = Date.now()) {
  if (!offer) return "expired";
  if (offer.active === false) return "paused";

  const ends = offer.endsAt ? new Date(offer.endsAt).getTime() : null;
  if (ends !== null && now > ends) return "expired";

  const starts = offer.startsAt ? new Date(offer.startsAt).getTime() : null;
  if (starts !== null && now < starts) return "scheduled";

  return "live";
}

/** True only while the offer can be claimed by clients. */
export function isOfferLive(offer, now = Date.now()) {
  return getOfferStatus(offer, now) === "live";
}

/** "2d 04h 11m 09s" style countdown, or "Closed". */
export function formatRemaining(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "Closed";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

/**
 * Resolve the numeric discount an offer grants.
 * Prefers the explicit discountType/discountValue fields, and falls back to
 * parsing the human readable discountLabel (e.g. "30% OFF" or "₹100 OFF")
 * so older offers keep working.
 */
export function getOfferDiscountConfig(offer) {
  if (!offer) return { type: "percent", value: 0 };

  const explicit = Number(offer.discountValue) || 0;
  if (explicit > 0) {
    return {
      type: offer.discountType === "fixed" ? "fixed" : "percent",
      value: explicit,
    };
  }

  const label = String(offer.discountLabel || "");
  const percentMatch = label.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) return { type: "percent", value: Number(percentMatch[1]) };

  const fixedMatch = label.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
  if (fixedMatch) return { type: "fixed", value: Number(fixedMatch[1]) };

  return { type: "percent", value: 0 };
}

/**
 * Discount amount for a given price. Never lets the payable price drop
 * below ₹1 (a zero-rupee UPI request cannot be paid).
 */
export function calculateDiscount(price, offer) {
  const base = Math.max(0, Number(price) || 0);
  if (!offer || base <= 0) return 0;

  const { type, value } = getOfferDiscountConfig(offer);
  if (!Number.isFinite(value) || value <= 0) return 0;

  const raw = type === "fixed" ? value : (base * value) / 100;
  const maxDiscount = base > 1 ? base - 1 : base;
  const discount = Math.min(raw, maxDiscount);
  return Math.round(discount * 100) / 100;
}

/** Convert a date to a value usable by <input type="datetime-local">. */export function toDateTimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Human readable date/time for admin tables. */
export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
