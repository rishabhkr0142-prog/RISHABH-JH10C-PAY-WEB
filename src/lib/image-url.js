export const ALLOWED_IMAGE_HOSTS = ["res.cloudinary.com"];

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

/**
 * Trim and force external image URLs to https. Returns "" for invalid or
 * unsafe URLs (javascript:, data:, localhost, ...). Relative paths are kept.
 */
export function normalizeImageUrl(value) {
  if (value === undefined || value === null) return "";

  let url = String(value).trim();
  if (!url) return "";

  if (url.startsWith("//")) url = `https:${url}`;
  if (url.startsWith("/")) {
    if (url.startsWith("/uploads/") || url.includes("public/uploads")) return "";
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    if (parsed.protocol !== "https:") return "";
    if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase())) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Whether next/image can safely render this URL with the configured
 * remotePatterns (res.cloudinary.com only) without throwing.
 */
export function isRenderableImageUrl(value) {
  const url = normalizeImageUrl(value);
  if (!url) return false;
  if (url.startsWith("/")) return true;

  try {
    return ALLOWED_IMAGE_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}
