import mongoose from "mongoose";

/**
 * Product — a digital product listed in the store.
 * Created/edited/deleted from the admin panel (/admin/products).
 */
const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
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
    // Nitro-style duration pricing plans (e.g., 7 Days, 30 Days, Lifetime)
    plans: {
      type: [
        {
          label: { type: String, trim: true, default: "" },
          days: { type: Number, default: 0, min: 0 }, // 0 = Lifetime
          price: { type: Number, required: true, min: 0, default: 0 },
          stock: { type: Number, default: 10, min: 0 },
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
