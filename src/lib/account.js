import connectDB from "@/lib/db";
import User from "@/models/User";

const SYNTHETIC_DISCORD_PREFIX = "google:";

export function isRealDiscordId(value) {
  return typeof value === "string" && /^\d{15,25}$/.test(value.trim());
}

export function syntheticDiscordId(googleSub) {
  return `${SYNTHETIC_DISCORD_PREFIX}${String(googleSub || "").trim()}`;
}

export function isSyntheticDiscordId(value) {
  return String(value || "").startsWith(SYNTHETIC_DISCORD_PREFIX);
}

/** Real Discord ID linked to this user, or "" when Discord is not linked. */
export function linkedDiscordId(userDoc) {
  const providerId = userDoc?.authProviders?.discord?.id;
  if (isRealDiscordId(providerId)) return String(providerId).trim();
  if (isRealDiscordId(userDoc?.discordId)) return String(userDoc.discordId).trim();
  return "";
}

export function linkedGoogleSub(userDoc) {
  const sub = userDoc?.authProviders?.google?.sub;
  return sub ? String(sub).trim() : "";
}

export function linkedGoogleEmail(userDoc) {
  const email = userDoc?.authProviders?.google?.email;
  return email ? String(email).trim().toLowerCase() : "";
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return User.findOne({
    email: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" },
  });
}

/**
 * Resolve the MongoDB user document for a NextAuth session.
 * Supports both the new session shape (id = Mongo _id) and legacy sessions
 * where id was the Discord ID.
 */
export async function findUserForSession(session) {
  if (!session?.user?.id) return null;

  await connectDB();

  const id = String(session.user.id);

  if (/^[a-f\d]{24}$/i.test(id)) {
    const byId = await User.findById(id);
    if (byId) return byId;
  }

  if (session.user.discordId) {
    const byDiscord = await User.findOne({
      $or: [
        { discordId: String(session.user.discordId) },
        { "authProviders.discord.id": String(session.user.discordId) },
      ],
    });
    if (byDiscord) return byDiscord;
  }

  if (session.user.googleSub) {
    const byGoogle = await User.findOne({
      "authProviders.google.sub": String(session.user.googleSub),
    });
    if (byGoogle) return byGoogle;
  }

  if (isRealDiscordId(id)) {
    return User.findOne({
      $or: [{ discordId: id }, { "authProviders.discord.id": id }],
    });
  }

  return null;
}

/** Update lifetime purchase metrics for the account that owns an order. */
export async function markOrderBuyerAsClient(order) {
  if (!order) return;

  const update = {
    $set: { role: "client" },
    $inc: { orderCount: 1, totalSpent: Number(order.price || order.amount) || 0 },
  };

  if (order.user) {
    await User.findByIdAndUpdate(order.user, update);
    return;
  }

  if (isRealDiscordId(order.discordId)) {
    await User.findOneAndUpdate({ discordId: String(order.discordId) }, update);
  }
}
