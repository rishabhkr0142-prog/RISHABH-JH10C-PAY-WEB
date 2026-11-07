import mongoose from "mongoose";

/**
 * PaymentLog — append-only audit trail for payment soft-delete/restore.
 * Only non-sensitive identifiers are stored (UTR, amount, admin identity and
 * the optional reason). No payer UPI, email or other personal data is logged.
 */
const PaymentLogSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    utr: { type: String, default: "", index: true },
    amountPaise: { type: Number, default: 0 },
    action: {
      type: String,
      enum: ["delete", "restore"],
      required: true,
      index: true,
    },
    adminId: { type: String, default: "", index: true },
    adminDiscordId: { type: String, default: "" },
    reason: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true, collection: "payment_logs" }
);

// Audit logs are temporary: MongoDB removes them automatically after 7 days.
PaymentLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, name: "ttl_payment_logs_7d" }
);
PaymentLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.models.PaymentLog ||
  mongoose.model("PaymentLog", PaymentLogSchema);
