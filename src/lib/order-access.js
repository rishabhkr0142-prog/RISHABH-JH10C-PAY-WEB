import { isUserAdmin } from "@/lib/auth";

/**
 * Server-side ownership check for an order.
 * A license key is only ever returned to its owner (or the store admin).
 */
export function isOrderOwner(order, session, userDoc) {
  if (!order || !session?.user?.id) return false;

  const userId = String(session.user.id);
  const email = String(session.user.email || "").toLowerCase();

  return Boolean(
    (order.userId && String(order.userId) === userId) ||
      (order.discordId && String(order.discordId) === userId) ||
      (userDoc?._id && order.user && String(order.user) === String(userDoc._id)) ||
      (email && order.email && String(order.email).toLowerCase() === email)
  );
}

/** Owner OR store admin. */
export function canAccessOrder(order, session, userDoc) {
  return isOrderOwner(order, session, userDoc) || isUserAdmin(session);
}

/**
 * License keys are returned only when the logged-in Discord ID matches the
 * order's discordId exactly. Email/user-ref matches are not enough.
 */
export function isLicenseOwner(order, session) {
  if (!order || !session?.user?.id) return false;
  return (
    Boolean(order.discordId) &&
    String(order.discordId) === String(session.user.id)
  );
}

/** Remove the license key from an order snapshot for non-owners. */
export function redactOrderLicense(order, session) {
  if (!order || typeof order !== "object") return order;
  if (isLicenseOwner(order, session)) return order;
  const safe = { ...order };
  delete safe.licenseKey;
  return safe;
}

/** Strict Discord-owner check (used for license key delivery actions). */
export function isStrictOrderOwner(order, session, userDoc) {
  if (!order || !session?.user?.id) return false;
  if (isUserAdmin(session)) return true;
  return isLicenseOwner(order, session);
}
