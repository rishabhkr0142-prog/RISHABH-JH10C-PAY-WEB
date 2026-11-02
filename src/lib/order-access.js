import { isUserAdmin } from "@/lib/auth";
import { isRealDiscordId, linkedDiscordId } from "@/lib/account";

/**
 * Server-side ownership helpers.
 *
 * New orders reference the Mongo user document (order.user / order.userId).
 * Legacy orders store the buyer's Discord ID in userId/discordId. Both are
 * accepted, but only identities actually linked to the account are used.
 */

function orderIdentities(session, userDoc) {
  const userIds = new Set();
  const discordIds = new Set();

  if (session?.user?.id) {
    const id = String(session.user.id);
    userIds.add(id);
    if (isRealDiscordId(id)) discordIds.add(id);
  }

  if (session?.user?.discordId) {
    discordIds.add(String(session.user.discordId));
  }

  if (userDoc?._id) {
    userIds.add(String(userDoc._id));
    const linked = linkedDiscordId(userDoc);
    if (linked) discordIds.add(linked);
  }

  return { userIds, discordIds };
}

/** Build a Mongo filter that matches only orders owned by this session. */
export function ownerFilterFor(session, userDoc) {
  if (!session?.user?.id) return null;

  const { userIds, discordIds } = orderIdentities(session, userDoc);
  const clauses = [];

  if (userDoc?._id) clauses.push({ user: userDoc._id });
  if (userIds.size) clauses.push({ userId: { $in: [...userIds] } });
  if (discordIds.size) clauses.push({ discordId: { $in: [...discordIds] } });

  return clauses.length ? { $or: clauses } : null;
}

/** Server-side ownership check for an order document. */
export function isOrderOwner(order, session, userDoc) {
  if (!order || !session?.user?.id) return false;

  const { userIds, discordIds } = orderIdentities(session, userDoc);

  return Boolean(
    (order.userId && userIds.has(String(order.userId))) ||
      (order.discordId && discordIds.has(String(order.discordId))) ||
      (userDoc?._id && order.user && String(order.user) === String(userDoc._id))
  );
}

/** Owner OR store admin. */
export function canAccessOrder(order, session, userDoc) {
  return isOrderOwner(order, session, userDoc) || isUserAdmin(session);
}

/** License keys are returned only to an account that owns the order. */
export function isLicenseOwner(order, session, userDoc) {
  return isOrderOwner(order, session, userDoc);
}

/** Remove the license key from an order snapshot for non-owners. */
export function redactOrderLicense(order, session, userDoc) {
  if (!order || typeof order !== "object") return order;
  if (isLicenseOwner(order, session, userDoc)) return order;
  const safe = { ...order };
  delete safe.licenseKey;
  return safe;
}

/** Owner or admin check used for license key delivery actions. */
export function isStrictOrderOwner(order, session, userDoc) {
  if (!order || !session?.user?.id) return false;
  if (isUserAdmin(session)) return true;
  return isOrderOwner(order, session, userDoc);
}
