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

const DeliveryContentSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", maxlength: 200 },
    link: { type: String, default: "", maxlength: 2000 },
    message: { type: String, default: "", maxlength: 5000 },
    buttonLabel: { type: String, default: "", maxlength: 80 },
    stockItem: { type: String, default: "", maxlength: 5000 },
  },
  { _id: false }
);

const StockReservationSchema = new mongoose.Schema(
  {
    productId: { type: String, default: "" },
    mode: { type: String, default: "unlimited" },
    scope: { type: String, default: "product" },
    planId: { type: String, default: "" },
    planLabel: { type: String, default: "" },
    quantity: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    // Human-friendly unique order reference (e.g. ORD-20261107-A1B2C3).
    orderNo: {
      type: String,
      default: "",
      trim: true,
    },
    // Buyer account id (Mongo User._id for new orders, legacy Discord ID for old ones)
    userId: {
      type: String,
      default: "",
    },
    // "product" for normal purchases, "reseller_membership" for the ₹149 plan.
    orderType: {
      type: String,
      enum: ["product", "reseller_membership"],
      default: "product",
    },
    // Reference to User document
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Product reference
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
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
    },
    // Payment window expiration (defaults to 15 minutes from creation)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000),
    },
    // Verified 12-digit UPI UTR reference
    utr: {
      type: String,
      default: "",
      trim: true,
    },
    // Reference to claimed Payment document
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
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
    // Reseller discount snapshot (never stacked with a coupon discount).
    resellerDiscount: { type: Number, default: 0, min: 0 },
    resellerDiscountPercent: { type: Number, default: 0, min: 0 },
    originalPrice: { type: Number, default: 0, min: 0 },
    // Buyer details snapshot for resilience
    customerName: { type: String, default: "Guest" },
    email: { type: String, default: "" },
    discordId: { type: String, default: "" },
    productName: { type: String, default: "" },
    // Snapshot of the product's license app key: "uid" or "lib".
    productKey: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    // Snapshot of how this order is fulfilled: "license" or "content".
    deliveryType: {
      type: String,
      enum: ["license", "content"],
      default: "license",
    },
    // Immutable content snapshot created only after payment is verified.
    deliveryContent: {
      type: DeliveryContentSchema,
      default: undefined,
    },
    quantity: { type: Number, default: 1, min: 1 },
    // Stock reservation lifecycle. A unit is reserved while the order is
    // waiting for payment, then committed after the payment is verified.
    // Released units are returned exactly once (flags make this idempotent).
    stockReserved: { type: Boolean, default: false },
    stockCommitted: { type: Boolean, default: false },
    stockReleased: { type: Boolean, default: false },
    stockReservation: {
      type: StockReservationSchema,
      default: undefined,
    },
    stockReservationExpiresAt: { type: Date, default: null },
    stockError: { type: String, default: "" },
    notes: { type: String, default: "" },
    // License delivery (one order = one key, generated server-side only)
    licenseKey: { type: String },
    deliveredAt: { type: Date, default: null },
    licenseError: { type: String, default: "" },
    licenseAttempts: { type: Number, default: 0, min: 0 },
    deliveryError: { type: String, default: "" },
    deliveryAttempts: { type: Number, default: 0, min: 0 },
    // Discord DM delivery status
    dmSent: { type: Boolean, default: false },
    dmError: { type: String, default: "" },
    // Set when DM delivery was intentionally skipped (e.g. discord_not_linked)
    dmSkipReason: { type: String, default: "" },
    dmSentAt: { type: Date, default: null },
    dmLastResentAt: { type: Date, default: null },
    // Discord sale webhook notification
    saleNotified: { type: Boolean, default: false },
    notifiedAt: { type: Date, default: null },
    notifyError: { type: String, default: "" },
  },
  { timestamps: true, collection: "orders" }
);

// Compound indexes for the hot query paths (owner dashboard, webhook matching).
// Unique human-friendly order reference. Partial so legacy orders without a
// value do not collide with each other.
OrderSchema.index(
  { orderNo: 1 },
  {
    unique: true,
    partialFilterExpression: { orderNo: { $gt: "" } },
    name: "uniq_order_no",
  }
);
OrderSchema.index({ discordId: 1, createdAt: -1 }, { name: "idx_orders_discord_created" });
OrderSchema.index({ userId: 1, createdAt: -1 }, { name: "idx_orders_user_created" });
OrderSchema.index({ status: 1, createdAt: -1 }, { name: "idx_orders_status_created" });
OrderSchema.index(
  { amountPaise: 1, status: 1, expiresAt: 1 },
  { name: "idx_orders_amount_status_expiry" }
);
OrderSchema.index(
  { orderType: 1, status: 1, expiresAt: 1 },
  { name: "idx_orders_type_status_expiry" }
);

// Pre-save hook: sync amountPaise <-> price
OrderSchema.pre("save", function (next) {
  if (this.amountPaise !== undefined && this.amountPaise > 0) {
    this.price = this.amountPaise / 100;
    this.amount = this.price;
  } else if (this.price !== undefined && this.price > 0 && (!this.amountPaise || this.amountPaise === 0)) {
    this.amountPaise = Math.round(this.price * 100);
    this.amount = this.price;
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
