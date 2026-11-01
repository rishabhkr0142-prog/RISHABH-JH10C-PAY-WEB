import { isUserAdmin } from "@/lib/auth";

/**
 * Strict, server-side ownership helpers.
 *
 * A license key is only ever returned to the Discord account that placed the
 * order (or the store admin). Email addresses are never used for ownership,
 * because Discord accounts can change their email at any time.
 */

/** Build a Mongo filter that matches only orders owned by this session. */
export function ownerFilterFor(session, userDoc) {
  if (!session?.user?.id) return null;
  const discordId = String(session.user.id);

  const clauses = [{ discordId }, { userId: discordId }];
  if (userDoc?._id) clauses.push({ user: userDoc._id });

  return { $or: clauses };
}

/** Server-side ownership check for an order document. */
export function isOrderOwner(order, session, userDoc) {
  if (!order || !session?.user?.id) return false;

  const userId = String(session.user.id);

  return Boolean(
    (order.userId && String(order.userId) === userId) ||
      (order.discordId && String(order.discordId) === userId) ||
      (userDoc?._id && order.user && String(order.user) === String(userDoc._id))
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
