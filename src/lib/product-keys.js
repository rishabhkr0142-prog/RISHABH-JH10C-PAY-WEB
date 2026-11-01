/**
 * Shared product identifiers used to pick the correct auth-panel application.
 *
 * Safe to import from both server and client code (no secrets here).
 * Adding a new license product only requires adding its key here and one
 * matching APP_IDS entry in src/lib/mani.js.
 */

export const PRODUCT_KEYS = ["uid", "lib"];

export const PRODUCT_LABELS = {
  uid: "UID Bypass",
  lib: "LIB Bypass",
};

/** Normalize any stored/typed product key to its canonical lowercase value. */
export function normalizeProductKey(value) {
  const key = String(value ?? "")
    .trim()
    .toLowerCase();
  return PRODUCT_KEYS.includes(key) ? key : "";
}

/** Human-readable product name for a product key. */
export function productLabel(productKey, fallback = "") {
  return PRODUCT_LABELS[normalizeProductKey(productKey)] || fallback;
}

/** True when the value is one of the configured license product keys. */
export function isKnownProductKey(value) {
  return Boolean(normalizeProductKey(value));
}
