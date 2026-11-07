export const ALLOWED_IMAGE_HOSTS = ["res.cloudinary.com"];

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const CLOUDINARY_HOST = "res.cloudinary.com";
const CLOUDINARY_UPLOAD_MARKER = "/image/upload/";
const MAX_IMAGE_URL_LENGTH = 2000;

/** True for inline image payloads that must never be stored in MongoDB. */
export function isInlineImageData(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  return /^data:image\//i.test(raw) || /^data:/i.test(raw);
}

/**
 * Trim and force external image URLs to https. Returns "" for invalid or
 * unsafe URLs (javascript:, data:, blob:, localhost, ...). Relative paths are
 * kept so local assets continue to work.
 */
export function normalizeImageUrl(value) {
  if (value === undefined || value === null) return "";

  let url = String(value).trim();
  if (!url) return "";
  if (url.length > MAX_IMAGE_URL_LENGTH) return "";
  if (isInlineImageData(url)) return "";

  if (url.startsWith("//")) url = `https:${url}`;
  if (url.startsWith("/")) {
    if (url.startsWith("/uploads/") || url.includes("public/uploads")) return "";
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    if (parsed.protocol !== "https:") return "";
    if (parsed.protocol === "blob:") return "";
    if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase())) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Strict validator for admin-entered offer image links. Only absolute https
 * URLs are accepted; empty stays empty. Returns "" for anything else.
 */
export function normalizeOfferImageUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^https:\/\//i.test(raw)) return "";
  return normalizeImageUrl(raw);
}

/**
 * Extract the Cloudinary public_id from a delivery URL so a deleted product
 * can also remove its uploaded image.
 * Example: .../image/upload/f_auto,q_auto/v171/file.webp -> "folder/file"
 */
export function cloudinaryPublicIdFromUrl(value) {
  const url = normalizeImageUrl(value);
  if (!url || url.startsWith("/")) return "";

  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== CLOUDINARY_HOST) return "";

    const markerIndex = parsed.pathname.indexOf(CLOUDINARY_UPLOAD_MARKER);
    if (markerIndex === -1) return "";

    const rest = parsed.pathname.slice(
      markerIndex + CLOUDINARY_UPLOAD_MARKER.length
    );
    const segments = rest.split("/").filter(Boolean);
    if (segments.length === 0) return "";

    // Drop optional transformation segment (f_auto,q_auto / w_600, ...).
    if (segments[0] && /^[a-z]{1,3}_[^/]*$/i.test(segments[0]) && !/^v\d+$/i.test(segments[0])) {
      segments.shift();
    }
    // Drop optional version segment (v1712345678).
    if (segments[0] && /^v\d+$/i.test(segments[0])) segments.shift();
    if (segments.length === 0) return "";

    const joined = decodeURIComponent(segments.join("/"));
    return joined.replace(/\.[a-z0-9]+$/i, "") || "";
  } catch {
    return "";
  }
}

/**
 * Add Cloudinary delivery transformations without changing the stored value.
 * Non-Cloudinary URLs are returned unchanged.
 *
 * @param {string} value - Image URL
 * @param {{ width?: number }} [options] - Optional card/thumbnail width
 */
export function cloudinaryImageUrl(value, { width } = {}) {
  const url = normalizeImageUrl(value);
  if (!url || url.startsWith("/")) return url;

  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== CLOUDINARY_HOST) return url;

    const markerIndex = parsed.pathname.indexOf(CLOUDINARY_UPLOAD_MARKER);
    if (markerIndex === -1) return url;

    const before = parsed.pathname.slice(
      0,
      markerIndex + CLOUDINARY_UPLOAD_MARKER.length
    );
    const segments = parsed.pathname
      .slice(markerIndex + CLOUDINARY_UPLOAD_MARKER.length)
      .split("/")
      .filter((segment) => segment !== "");

    if (segments.length === 0) return url;

    const first = segments[0];
    const firstIsTransform =
      first &&
      /^[a-z]{1,3}_[^/]*$/i.test(first) &&
      !/^v\d+$/i.test(first);

    const wanted = ["f_auto", "q_auto"];
    let existing = [];

    if (firstIsTransform) {
      existing = first.split(",").filter(Boolean);
      segments.shift();
    }

    // Remove duplicates of the transformations we always force, then put the
    // forced ones first so URLs stay stable/idempotent.
    const kept = existing.filter(
      (part) => !/^f_/i.test(part) && !/^q_/i.test(part)
    );

    let transforms = [...wanted, ...kept];
    if (width) {
      transforms = transforms.filter((part) => !/^w_/i.test(part));
      transforms.push(`w_${Math.max(1, Math.round(Number(width) || 0))}`, "c_limit");
    }

    parsed.pathname = `${before}${transforms.join(",")}/${segments.join("/")}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Whether next/image can safely render this URL with the configured
 * remotePatterns (res.cloudinary.com + Google avatars) without throwing.
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
