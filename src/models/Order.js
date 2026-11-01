import mongoose from "mongoose";

/**
 * Order — one purchase / sale of a product.
 * Status transitions: pending -> paid -> completed (or cancelled).
 */
const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "expired",
  "cancelled",
  "completed",
];

const OrderSchema = new mongoose.Schema(
  {
    // Buyer Discord ID
    userId: {
      type: String,
      default: "",
      index: true,
    },
    // Reference to User document
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    // Product reference
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      index: true,
    },
    // Duration plan reference or identifier (e.g. "plan-30d", "Lifetime", etc.)
    planId: {
      type: String,
      default: "",
      trim: true,
    },
    // Exact payment amount in integer Paise (₹1 = 100 Paise)
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      index: true,
    },
    // Backward-compatible rupee fields (synced with amountPaise)
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
      index: true,
    },
    // Payment window expiration (defaults to 10 minutes from creation)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000),
      index: true,
    },
    // Verified 12-digit UPI UTR reference
    utr: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    // Reference to claimed Payment document
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      index: true,
    },
    // Timestamp when payment was confirmed
    paidAt: {
      type: Date,
      default: null,
    },
    // Snapshot of selected duration plan (if applicable)
    plan: {
      label: { type: String, default: "" },
      days: { type: Number, default: 0 },
      price: { type: Number, default: 0 },
    },
    // Coupon redemption snapshot (if a code was applied)
    couponCode: { type: String, default: "", trim: true },
    couponDiscount: { type: Number, default: 0, min: 0 },
    originalPrice: { type: Number, default: 0, min: 0 },
    // Buyer details snapshot for resilience
    customerName: { type: String, default: "Guest" },
    email: { type: String, default: "", index: true },
    discordId: { type: String, default: "", index: true },
    productName: { type: String, default: "" },
    // Snapshot of the product's license app key: "uid" or "lib".
    productKey: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },
    quantity: { type: Number, default: 1, min: 1 },
    notes: { type: String, default: "" },
    // License delivery (one order = one key, generated server-side only)
    licenseKey: { type: String },
    deliveredAt: { type: Date, default: null },
    licenseError: { type: String, default: "" },
    licenseAttempts: { type: Number, default: 0, min: 0 },
    // Discord DM delivery status
    dmSent: { type: Boolean, default: false },
    dmError: { type: String, default: "" },
    dmSentAt: { type: Date, default: null },
    dmLastResentAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "orders" }
);

// Compound indexes for the hot query paths (owner dashboard, webhook matching).
OrderSchema.index({ discordId: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ amountPaise: 1, status: 1, expiresAt: 1 });

// Pre-save hook: sync amountPaise <-> price and userId <-> discordId
OrderSchema.pre("save", function (next) {
  if (this.amountPaise !== undefined && this.amountPaise > 0) {
    this.price = this.amountPaise / 100;
    this.amount = this.price;
  } else if (this.price !== undefined && this.price > 0 && (!this.amountPaise || this.amountPaise === 0)) {
    this.amountPaise = Math.round(this.price * 100);
    this.amount = this.price;
  }
  if (!this.userId && this.discordId) {
    this.userId = this.discordId;
  } else if (!this.discordId && this.userId) {
    this.discordId = this.userId;
  }
  if (!this.productId && this.product) {
    this.productId = this.product;
  } else if (!this.product && this.productId) {
    this.product = this.productId;
  }
  next();
});

export { ORDER_STATUSES };
export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
