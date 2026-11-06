import mongoose from "mongoose";

/**
 * Payment — an incoming UPI payment record sent by Google Apps Script webhook
 * upon detecting a credit email from FamPay.
 */
const PaymentSchema = new mongoose.Schema(
  {
    // Unique 12-digit UPI UTR reference number from FamPay transaction
    utr: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    // FamPay internal transaction / reference ID
    txnId: {
      type: String,
      default: "",
      trim: true,
    },
    // Exact amount in integer Paise (₹100 = 10000 Paise)
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },
    // Sender / Payer UPI VPA (if available in the credit alert email)
    payerUpi: {
      type: String,
      default: "",
      trim: true,
    },
    // Timestamp when payment was made according to FamPay
    paidAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    // Claim status: unclaimed until matched automatically or verified by buyer via UTR.
    // "matched" is the canonical state for a payment linked to an order.
    // "claimed" is retained for backwards compatibility with older rows.
    // "deleted" is a soft-delete state: the UTR row is kept so a duplicate
    // webhook/UTR can never create a second unclaimed payment.
    status: {
      type: String,
      enum: ["unclaimed", "matched", "claimed", "deleted"],
      default: "unclaimed",
      index: true,
    },
    // True when the payment has been soft-deleted by an admin.
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Soft-delete metadata (kept for audit/debugging).
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      default: "",
    },
    deleteReason: {
      type: String,
      default: "",
      maxlength: 500,
    },
    // Reference to the claimed Order document
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    // Timestamp when webhook received and inserted this payment record
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, collection: "payments" }
);

// UTR is unique via the field definition above. Txn ID is unique only when a
// non-empty value is present (many legacy rows store "").
PaymentSchema.index(
  { txnId: 1 },
  {
    unique: true,
    partialFilterExpression: { txnId: { $gt: "" } },
    name: "uniq_payment_txn_id_nonempty",
  }
);

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
