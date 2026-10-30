import mongoose from "mongoose";

/**
 * Stat — single cached stats document used for the "Live Stats" section
 * on the home page (Total Users / Total Orders / Total Clients).
 * It is created lazily on first read (seeded from real collection counts)
 * and then kept in sync:
 *   - new user logs in            → users +1
 *   - order created in admin      → orders +1
 *   - client added in admin       → clients +1
 *   - admin /admin/stats          → manual override of any count
 */
const StatSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    users: { type: Number, default: 0, min: 0 },
    orders: { type: Number, default: 0, min: 0 },
    clients: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: "stats" }
);

export default mongoose.models.Stat || mongoose.model("Stat", StatSchema);
