import mongoose from "mongoose";

/**
 * A single unique stock item (account, credential, invite link, etc.).
 * Items live in their own collection so unclaimed values never leak through
 * public product documents. Completion claims one item atomically per order.
 */
const ProductStockItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    claimedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "product_stock_items" }
);

ProductStockItemSchema.index({ productId: 1, claimedOrderId: 1, createdAt: 1 });

export default mongoose.models.ProductStockItem ||
  mongoose.model("ProductStockItem", ProductStockItemSchema);
