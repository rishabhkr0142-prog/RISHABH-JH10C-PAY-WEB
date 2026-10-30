import mongoose from "mongoose";

/**
 * Order — one purchase / sale of a product.
 * Status transitions: pending -> paid -> completed (or cancelled).
 */
const ORDER_STATUSES = ["pending", "paid", "completed", "cancelled"];

const OrderSchema = new mongoose.Schema(
  {
    // Reference to User
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    // Reference to Product
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      index: true,
    },
    // Required price field
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    // Backward-compatible amount (synced with price)
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
    // Snapshot of selected duration plan (if applicable)
    plan: {
      label: { type: String, default: "" },
      days: { type: Number, default: 0 },
      price: { type: Number, default: 0 },
    },
    // Buyer details snapshot for resilience
    customerName: { type: String, default: "Guest" },
    email: { type: String, default: "", index: true },
    discordId: { type: String, default: "", index: true },
    productName: { type: String, default: "" },
    quantity: { type: Number, default: 1, min: 1 },
    notes: { type: String, default: "" },
  },
  { timestamps: true, collection: "orders" }
);

// Pre-save hook: sync amount <-> price
OrderSchema.pre("save", function (next) {
  if (this.price !== undefined && (!this.amount || this.amount === 0)) {
    this.amount = this.price;
  } else if (this.amount !== undefined && (!this.price || this.price === 0)) {
    this.price = this.amount;
  }
  next();
});

export { ORDER_STATUSES };
export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
