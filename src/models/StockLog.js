import mongoose from "mongoose";

/**
 * StockLog — append-only audit trail for inventory changes.
 * One row is written for admin adjustments, reservations, confirmations and
 * release operations so a mistake can always be traced to an order/admin.
 */
const StockLogSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productName: { type: String, default: "" },
    planId: { type: String, default: "" },
    planLabel: { type: String, default: "" },
    scope: {
      type: String,
      enum: ["product", "plan"],
      default: "product",
    },
    action: {
      type: String,
      enum: [
        "reserve",
        "confirm",
        "release",
        "admin_adjust",
        "out_of_stock_on",
        "out_of_stock_off",
        "stock_mode_change",
      ],
      required: true,
      index: true,
    },
    quantity: { type: Number, default: 0 },
    delta: { type: Number, default: 0 },
    stockBefore: { type: Number, default: null },
    stockAfter: { type: Number, default: null },
    reservedAfter: { type: Number, default: null },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    adminId: { type: String, default: "" },
    note: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true, collection: "stock_logs" }
);

StockLogSchema.index({ productId: 1, createdAt: -1 });
StockLogSchema.index({ orderId: 1, createdAt: -1 });
// Inventory audit logs are kept for 7 days only, then MongoDB expires them.
StockLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, name: "ttl_stock_logs_7d" }
);

export default mongoose.models.StockLog ||
  mongoose.model("StockLog", StockLogSchema);
