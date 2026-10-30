import mongoose from "mongoose";

/**
 * User — a Discord user who has logged in to the site.
 * Created automatically on first Discord OAuth login (see src/lib/auth.js).
 * Role can be "user", "client" (after purchase or marked by admin), or "admin".
 */
const UserSchema = new mongoose.Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, trim: true },
    // Full URL to the Discord avatar (https://cdn.discordapp.com/avatars/...)
    avatar: { type: String, default: "" },
    email: { type: String, default: "", trim: true },
    role: {
      type: String,
      enum: ["user", "client", "admin"],
      default: "user",
      index: true,
    },
  },
  { timestamps: true, collection: "users" }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
