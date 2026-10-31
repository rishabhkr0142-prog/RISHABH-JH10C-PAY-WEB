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
      index: true,
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
    // Claim status: unclaimed until matched automatically or verified by buyer via UTR
    status: {
      type: String,
      enum: ["unclaimed", "claimed"],
      default: "unclaimed",
      index: true,
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

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
