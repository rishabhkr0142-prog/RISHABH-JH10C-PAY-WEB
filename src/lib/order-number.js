import crypto from "crypto";

/**
 * Generate a short, unique, human-readable order reference.
 * Format: ORD-YYYYMMDD-XXXXXX (6 uppercase hex chars).
 * Uniqueness is also enforced by a partial unique index in MongoDB.
 */
export function generateOrderNo(date = new Date()) {
  const d = date instanceof Date ? date : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${year}${month}${day}-${suffix}`;
}

export default generateOrderNo;
