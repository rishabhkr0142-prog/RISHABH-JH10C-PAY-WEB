import mongoose from "mongoose";

/**
 * Client — a paying customer of the store (managed manually in /admin/clients
 * until the payment step is wired in; then auto-created on successful purchase).
 */
const ClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: "" },
    discordId: { type: String, default: "" },
    // Lifetime value of this client, updated manually (or later by checkout)
    totalSpent: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true, collection: "clients" }
);

export default mongoose.models.Client || mongoose.model("Client", ClientSchema);
