/**
 * Helpers for Google profile photos used by the public homepage row.
 * Kept dependency-free so both server code and client components can import it.
 */

const GOOGLE_AVATAR_ROOT = "googleusercontent.com";

/**
 * Only accept https URLs served from Google's image CDN. Anything else is
 * rejected so a tampered/stale record can never leak an arbitrary URL through
 * the public API.
 */
export function sanitizeGoogleAvatarUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (parsed.protocol !== "https:") return "";

    const host = parsed.hostname.toLowerCase();
    if (host !== GOOGLE_AVATAR_ROOT && !host.endsWith(`.${GOOGLE_AVATAR_ROOT}`)) {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

/** 1200 -> "1.2k", 12500 -> "12k", 1000000 -> "1m". */
export function formatCompactCount(value) {
  const n = Math.max(0, Number(value) || 0);

  if (n >= 1_000_000) {
    const scaled = n / 1_000_000;
    return `${(scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)).replace(
      /\.0$/,
      ""
    )}m`;
  }

  if (n >= 1_000) {
    const scaled = n / 1_000;
    return `${(scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)).replace(
      /\.0$/,
      ""
    )}k`;
  }

  return String(n);
}
