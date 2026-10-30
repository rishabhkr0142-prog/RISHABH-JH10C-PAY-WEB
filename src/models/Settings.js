import mongoose from "mongoose";

/**
 * Settings — Key-Value configuration store for the website.
 * Stores site name, support email, Discord server invite, etc.
 */
const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, default: "" },
  },
  { timestamps: true, collection: "settings" }
);

export default mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);

