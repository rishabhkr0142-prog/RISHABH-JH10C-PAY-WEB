import mongoose from "mongoose";

/**
 * Offer — a time-limited promotional offer shown on the home page.
 * Created/edited/deleted only from the admin panel (/admin/offers).
 * Once endsAt passes, the offer is closed for clients automatically.
 */
const OfferSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    badge: { type: String, default: "LIMITED TIME", trim: true },
    discountLabel: { type: String, default: "", trim: true },
    // Numeric discount applied when a client redeems couponCode
    discountType: {
      type: String,
      enum: ["percent", "fixed"],
      default: "percent",
    },
    discountValue: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: "", trim: true, uppercase: true },
    // Optional link to a catalog product (offer still shows without one)
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    productName: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "", trim: true },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "offers" }
);

export default mongoose.models.Offer || mongoose.model("Offer", OfferSchema);
