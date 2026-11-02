import mongoose from "mongoose";

/**
 * User — an account created through Google or Discord OAuth.
 * Created automatically on first login (see src/lib/auth.js).
 * Role can be "user", "client" (after purchase or marked by admin), or "admin".
 */
const UserSchema = new mongoose.Schema(
  {
    // Canonical login key. Real Discord snowflake for Discord-first accounts;
    // Google-only accounts use the internal "google:<sub>" placeholder until
    // Discord is linked. Use linkedDiscordId() instead of reading this directly.
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, trim: true },
    // Full URL to the profile avatar (https://cdn.discordapp.com/avatars/...)
    avatar: { type: String, default: "" },
    email: { type: String, default: "", trim: true, lowercase: true },
    // Verified identities linked to this account. Google is identified by the
    // stable "sub" claim, never by email.
    authProviders: {
      google: {
        sub: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
      },
      discord: {
        id: { type: String, trim: true },
      },
    },
    role: {
      type: String,
      enum: ["user", "client", "admin"],
      default: "user",
      index: true,
    },
    // Lifetime purchase metrics (updated atomically after payment verification)
    orderCount: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    // Last successful order creation — used for the atomic cooldown gate
    lastOrderAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "users" }
);

UserSchema.index(
  { "authProviders.google.sub": 1 },
  { unique: true, sparse: true }
);
UserSchema.index(
  { "authProviders.discord.id": 1 },
  { unique: true, sparse: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
