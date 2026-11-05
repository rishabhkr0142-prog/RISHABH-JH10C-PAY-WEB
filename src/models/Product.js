import mongoose from "mongoose";

/**
 * Product — a digital product listed in the store.
 * Created/edited/deleted from the admin panel (/admin/products).
 */
const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // License app this product belongs to: "uid" or "lib" (server-side only).
    productKey: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },
    // "license" generates an auth-panel key. "content" delivers admin-authored
    // details (link/message) after payment. Existing products default to license.
    deliveryType: {
      type: String,
      enum: ["license", "content"],
      default: "license",
      index: true,
    },
    // Default delivery content. Plans may override any field.
    deliveryTitle: { type: String, default: "", trim: true, maxlength: 200 },
    deliveryLink: { type: String, default: "", trim: true, maxlength: 2000 },
    deliveryMessage: { type: String, default: "", maxlength: 5000 },
    deliveryButtonLabel: { type: String, default: "", trim: true, maxlength: 80 },
    // Optional unique stock pool (one item is claimed per order).
    useStockItems: { type: Boolean, default: false },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0, default: 0 },
    // Inventory mode for products without plans. Existing products stay
    // "unlimited" so old stock numbers never block new orders.
    stockMode: {
      type: String,
      enum: ["unlimited", "limited"],
      default: "unlimited",
      index: true,
    },
    // Nitro-style duration pricing plans (e.g., 7 Days, 30 Days, Lifetime)
    plans: {
      type: [
        {
          label: { type: String, trim: true, default: "" },
          days: { type: Number, default: 0, min: 0 }, // 0 = Lifetime
          price: { type: Number, required: true, min: 0, default: 0 },
          // Per-plan inventory. Old plans without a mode are treated as
          // unlimited by the application and by the migration script.
          stockMode: {
            type: String,
            enum: ["unlimited", "limited"],
            default: "unlimited",
          },
          stock: { type: Number, default: 10, min: 0 },
          reserved: { type: Number, default: 0, min: 0 },
          outOfStock: { type: Boolean, default: false },
          deliveryTitle: { type: String, default: "", trim: true, maxlength: 200 },
          deliveryLink: { type: String, default: "", trim: true, maxlength: 2000 },
          deliveryMessage: { type: String, default: "", maxlength: 5000 },
          deliveryButtonLabel: { type: String, default: "", trim: true, maxlength: 80 },
        },
      ],
      default: [],
    },
    category: {
      type: String,
      default: "General",
      trim: true,
      index: true,
    },
    images: {
      type: [String],
      default: [],
    },
    // Backward-compatible single image URL
    imageUrl: { type: String, default: "" },
    features: {
      type: [String],
      default: [],
    },
    stock: { type: Number, default: 10, min: 0 },
    // Units currently held by unpaid orders (only meaningful in limited mode).
    reserved: { type: Number, default: 0, min: 0 },
    // Manual kill-switch that works even for unlimited products.
    outOfStock: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true, index: true },
    // Backward-compatible available flag (synced with active)
    available: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "products" }
);

// Pre-save hook: sync active <-> available and ensure imageUrl/images consistency
ProductSchema.pre("save", function (next) {
  if (this.active !== undefined && this.available === undefined) {
    this.available = this.active;
  } else if (this.available !== undefined && this.active === undefined) {
    this.active = this.available;
  }
  if (!this.imageUrl && this.images && this.images.length > 0) {
    this.imageUrl = this.images[0];
  } else if (this.imageUrl && (!this.images || this.images.length === 0)) {
    this.images = [this.imageUrl];
  }
  next();
});

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);
