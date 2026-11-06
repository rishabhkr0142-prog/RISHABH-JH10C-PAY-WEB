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

PaymentLogSchema.index({ createdAt: -1 });
PaymentLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.models.PaymentLog ||
  mongoose.model("PaymentLog", PaymentLogSchema);
