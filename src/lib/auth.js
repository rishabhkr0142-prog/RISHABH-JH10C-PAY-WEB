import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { incrementStat } from "@/lib/stats";
import {
  findUserByEmail,
  isRealDiscordId,
  linkedDiscordId,
  linkedGoogleSub,
  normalizeEmail,
  syntheticDiscordId,
} from "@/lib/account";

/**
 * NextAuth.js configuration — Discord + Google OAuth.
 *
 * Google is identified by the stable OpenID Connect "sub" claim. Email is only
 * used once it is verified, to link a Google login to an existing account
 * instead of creating a duplicate.
 */
const providers = [
  DiscordProvider({
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    authorization: { params: { scope: "identify email" } },
    issuer: "https://discord.com",
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
          access_type: "online",
        },
      },
    })
  );
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  debug: false,
  // Use our own login page (/login) and custom error page (/auth/error)
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    // Keep the internal Mongo user id in the JWT, plus both linked identities.
    async jwt({ token, user, account, profile, trigger }) {
      if (user?.dbId) {
        token.dbId = user.dbId;
        token.discordId = user.discordId || null;
        token.googleSub = user.googleSub || null;
        token.authProvider = user.authProvider || null;
      }

      // NextAuth may not forward custom fields mutated in signIn(), so resolve
      // the persisted account again from the provider identity on first login.
      if (!token.dbId && account) {
        try {
          await connectDB();
          const providerId = String(
            account.providerAccountId || profile?.sub || user?.id || ""
          );
          let existing = null;

          if (account.provider === "google" && providerId) {
            existing = await User.findOne({
              "authProviders.google.sub": providerId,
            }).lean();
          } else if (account.provider === "discord" && providerId) {
            existing = await User.findOne({
              $or: [
                { discordId: providerId },
                { "authProviders.discord.id": providerId },
              ],
            }).lean();
          }

          if (existing) {
            token.dbId = String(existing._id);
            token.discordId = linkedDiscordId(existing) || null;
            token.googleSub = linkedGoogleSub(existing) || null;
            token.authProvider = account.provider;
          }
        } catch (err) {
          console.error("JWT account lookup failed:", err?.message || err);
        }
      }

      // Older sessions only contain a Discord ID. Resolve it once to the
      // canonical Mongo user id so ownership checks keep working.
      if (!token.dbId && isRealDiscordId(token.discordId)) {
        try {
          await connectDB();
          const existing = await User.findOne({
            $or: [
              { discordId: String(token.discordId) },
              { "authProviders.discord.id": String(token.discordId) },
            ],
          }).lean();
          if (existing) {
            token.dbId = String(existing._id);
            token.googleSub = linkedGoogleSub(existing) || null;
          }
        } catch (err) {
          console.error("JWT legacy session lookup failed:", err?.message || err);
        }
      }

      // After linking a provider, refresh identity fields without re-login.
      if (trigger === "update" && token.dbId) {
        try {
          await connectDB();
          const fresh = await User.findById(token.dbId).lean();
          if (fresh) {
            token.discordId = linkedDiscordId(fresh) || null;
            token.googleSub = linkedGoogleSub(fresh) || null;
          }
        } catch (err) {
          console.error("JWT session refresh failed:", err?.message || err);
        }
      }

      return token;
    },

    // Expose the internal user id, linked identities and admin flag.
    async session({ session, token }) {
      if (session?.user) {
        session.user.id =
          token?.dbId ||
          (isRealDiscordId(token?.discordId) ? token.discordId : token?.sub) ||
          undefined;
        session.user.discordId = token?.discordId || "";
        session.user.googleSub = token?.googleSub || "";
        session.user.authProvider = token?.authProvider || "";
        session.user.isAdmin = isUserAdmin(session);
      }
      return session;
    },

    // Create or link the provider account in MongoDB on sign-in.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "discord" && account?.provider !== "google") {
        return true;
      }

      try {
        await connectDB();

        if (account.provider === "google") {
          const result = await signInWithGoogle({ user, account, profile });
          if (result !== true) return result;
        } else {
          const result = await signInWithDiscord({ user, account, profile });
          if (result !== true) return result;
        }
      } catch (err) {
        console.error(
          `❌ MongoDB save error in ${account.provider} signIn callback:`,
          err?.message || err
        );
        return "/login?error=DatabaseError";
      }

      return true;
    },
  },
};

async function signInWithDiscord({ user, account, profile }) {
  const discordId = String(account?.providerAccountId || user?.id || "");
  if (!discordId) return "/login?error=OAuthCallback";

  const verifiedEmail = profile?.verified
    ? normalizeEmail(user?.email || profile?.email)
    : "";

  let existing = await User.findOne({
    $or: [
      { discordId },
      { "authProviders.discord.id": discordId },
    ],
  });

  if (!existing && verifiedEmail) {
    const byEmail = await findUserByEmail(verifiedEmail);
    if (byEmail) {
      const alreadyLinked = linkedDiscordId(byEmail);
      if (alreadyLinked && alreadyLinked !== discordId) {
        return "/login?error=DiscordAlreadyLinked";
      }
      existing = byEmail;
    }
  }

  const isAdmin = isAdminDiscordId(discordId);
  let saved;

  if (!existing) {
    saved = await User.create({
      discordId,
      username: user?.name || discordId,
      avatar: user?.image || "",
      email: verifiedEmail,
      role: isAdmin ? "admin" : "user",
      authProviders: { discord: { id: discordId } },
    });
    await incrementStat("users");
  } else {
    saved = await User.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          discordId,
          "authProviders.discord.id": discordId,
          username: user?.name || existing.username,
          avatar: user?.image || existing.avatar,
          ...(verifiedEmail ? { email: verifiedEmail } : {}),
          ...(isAdmin ? { role: "admin" } : {}),
        },
      },
      { new: true }
    );
  }

  if (saved) {
    user.dbId = String(saved._id);
    user.discordId = linkedDiscordId(saved) || "";
    user.googleSub = linkedGoogleSub(saved) || "";
    user.authProvider = "discord";
  }

  return true;
}

async function signInWithGoogle({ user, account, profile }) {
  const googleSub = String(profile?.sub || account?.providerAccountId || "");
  if (!googleSub) return "/login?error=OAuthCallback";

  const emailVerified =
    profile?.email_verified === true || profile?.email_verified === "true";
  const email = emailVerified
    ? normalizeEmail(profile?.email || user?.email)
    : "";

  let existing = await User.findOne({
    "authProviders.google.sub": googleSub,
  });

  if (!existing && email) {
    const byEmail = await findUserByEmail(email);
    if (byEmail) {
      const existingSub = linkedGoogleSub(byEmail);
      if (existingSub && existingSub !== googleSub) {
        return "/login?error=AccountAlreadyLinked";
      }
      existing = byEmail;
    }
  }

  let saved;

  if (!existing) {
    saved = await User.create({
      discordId: syntheticDiscordId(googleSub),
      username: user?.name || email || `Google ${googleSub.slice(-6)}`,
      avatar: user?.image || "",
      email,
      role: "user",
      authProviders: {
        google: { sub: googleSub, email },
      },
    });
    await incrementStat("users");
  } else {
    saved = await User.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          "authProviders.google.sub": googleSub,
          "authProviders.google.email": email,
          ...(email && !existing.email ? { email } : {}),
          ...(user?.image && !existing.avatar ? { avatar: user.image } : {}),
        },
      },
      { new: true }
    );
  }

  if (saved) {
    user.dbId = String(saved._id);
    user.discordId = linkedDiscordId(saved) || "";
    user.googleSub = linkedGoogleSub(saved) || "";
    user.authProvider = "google";
  }

  return true;
}

function adminDiscordIds() {
  return String(process.env.ADMIN_DISCORD_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAdminDiscordId(discordId) {
  if (!isRealDiscordId(discordId)) return false;
  return adminDiscordIds().includes(String(discordId));
}

/**
 * Is this session allowed to use the admin panel?
 * Only the Discord ID(s) set in ADMIN_DISCORD_ID in .env (the owner) pass.
 * Never decides admin from client side.
 */
export function isUserAdmin(session) {
  const discordId =
    session?.user?.discordId ||
    (isRealDiscordId(session?.user?.id) ? session.user.id : "");
  return isAdminDiscordId(discordId);
}
