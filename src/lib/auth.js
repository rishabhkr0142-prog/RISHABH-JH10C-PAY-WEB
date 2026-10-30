import DiscordProvider from "next-auth/providers/discord";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { incrementStat } from "@/lib/stats";

/**
 * NextAuth.js configuration — Discord OAuth2 login.
 *
 * Flow:
 *  1. User clicks "Login with Discord" → /login → signIn("discord")
 *  2. Discord redirects back to /api/auth/callback/discord
 *  3. On Discord login we save or update the user in MongoDB
 *     (discordId, username, avatar, email).
 *  4. Admin status is determined purely by ADMIN_DISCORD_ID in .env.
 */
export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  debug: false,
  // Use our own login page (/login) and custom error page (/auth/error)
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify email" } },
      issuer: "https://discord.com",
    }),
  ],
  callbacks: {
    // Attach the Discord ID to the JWT so every session carries it.
    async jwt({ token, user }) {
      if (user) {
        token.discordId = String(user.id);
      }
      return token;
    },

    // Expose the Discord ID and server-verified isAdmin to the app.
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token?.discordId || undefined;
        session.user.isAdmin = isUserAdmin(session);
      }
      return session;
    },

    // Sync the Discord user into MongoDB on sign-in (create on first login, update if exists).
    async signIn({ user, account, profile }) {
      if (account?.provider !== "discord") return true;

      try {
        await connectDB();

        const discordId = String(user?.id || account?.providerAccountId || "");
        if (!discordId) return true;

        const isAdmin = isUserAdmin({ user: { id: discordId } });
        const existing = await User.findOne({ discordId });

        if (!existing) {
          await User.create({
            discordId,
            username: user?.name || discordId,
            avatar: user?.image || "",
            email: user?.email || "",
            role: isAdmin ? "admin" : "user",
          });
          // New user → "Total Users" grows by one.
          await incrementStat("users");
        } else {
          // Update details from Discord
          await User.updateOne(
            { discordId },
            {
              $set: {
                username: user?.name || existing.username,
                avatar: user?.image || existing.avatar,
                email: user?.email || existing.email,
                ...(isAdmin ? { role: "admin" } : {}),
              },
            }
          );
        }
      } catch (err) {
        // Never block login because of a database failure
        console.error("❌ MongoDB save error in signIn callback:", err?.message || err);
      }

      return true;
    },
  },
};

/**
 * Is this session allowed to use the admin panel?
 * Only the Discord ID(s) set in ADMIN_DISCORD_ID in .env (the owner) pass.
 * Never decides admin from client side.
 */
export function isUserAdmin(session) {
  const adminId = process.env.ADMIN_DISCORD_ID;
  if (!adminId || !session?.user?.id) return false;
  const adminIds = adminId
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return adminIds.includes(String(session.user.id));
}
