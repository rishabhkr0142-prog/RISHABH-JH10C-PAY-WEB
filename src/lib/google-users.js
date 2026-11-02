import { unstable_cache } from "next/cache";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { sanitizeGoogleAvatarUrl } from "@/lib/google-avatar";

export const GOOGLE_USERS_CACHE_TAG = "public-google-users";
export const GOOGLE_USERS_REVALIDATE_SECONDS = 300;
export const GOOGLE_USERS_AVATAR_LIMIT = 4;

/** Accounts that signed in with (or linked) Google, identified by stable sub. */
export function googleUserFilter() {
  return {
    "authProviders.google.sub": { $exists: true, $nin: ["", null] },
  };
}

async function queryGoogleUsersStats() {
  try {
    await connectDB();

    const [total, avatarDocs] = await Promise.all([
      User.countDocuments(googleUserFilter()).catch(() => 0),
      User.find({
        ...googleUserFilter(),
        showOnHomepage: { $ne: false },
        $or: [
          { googlePicture: { $exists: true, $nin: ["", null] } },
          { avatar: { $exists: true, $nin: ["", null] } },
        ],
      })
        .sort({ lastGoogleLoginAt: -1, updatedAt: -1 })
        .limit(GOOGLE_USERS_AVATAR_LIMIT * 3)
        .select("googlePicture avatar -_id")
        .lean()
        .catch(() => []),
    ]);

    const avatars = avatarDocs
      // `googlePicture` is the canonical field; `avatar` is only a safe
      // fallback for accounts created before this field existed. Both are
      // validated so only Google CDN photos can ever be exposed.
      .map(
        (doc) =>
          sanitizeGoogleAvatarUrl(doc?.googlePicture) ||
          sanitizeGoogleAvatarUrl(doc?.avatar)
      )
      .filter(Boolean)
      .slice(0, GOOGLE_USERS_AVATAR_LIMIT);

    return { total: Math.max(0, Number(total) || 0), avatars };
  } catch (err) {
    console.error("Google users stats failed:", err?.message || err);
    return { total: 0, avatars: [] };
  }
}

/**
 * Cached public stats: aggregate Google sign-in count + up to 4 opted-in photo
 * URLs. Never returns names, emails, Google subs, or any other account field.
 */
export const getGoogleUsersStats = unstable_cache(
  queryGoogleUsersStats,
  ["public-google-users-v1"],
  {
    revalidate: GOOGLE_USERS_REVALIDATE_SECONDS,
    tags: [GOOGLE_USERS_CACHE_TAG],
  }
);
