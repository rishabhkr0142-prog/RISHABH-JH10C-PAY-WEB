import connectDB from "@/lib/db";
import Offer from "@/models/Offer";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find a live offer by coupon code. When the offer is linked to a product,
 * the code only works for that product.
 */
export async function getCouponOffer(code, productId, now = new Date()) {
  const clean = String(code || "").trim();
  if (!clean) return null;

  try {
    await connectDB();
    const offer = await Offer.findOne({
      couponCode: { $regex: `^${escapeRegex(clean)}$`, $options: "i" },
      active: true,
      endsAt: { $gte: now },
      $or: [
        { startsAt: { $exists: false } },
        { startsAt: null },
        { startsAt: { $lte: now } },
      ],
    }).lean();

    if (!offer) return null;

    if (offer.productId && String(offer.productId) !== String(productId || "")) {
      return null;
    }

    return JSON.parse(JSON.stringify(offer));
  } catch (err) {
    console.error("Failed to resolve coupon:", err?.message || err);
    return null;
  }
}

/**
 * Offers that clients are allowed to see right now.
 * Expired, paused, and not-yet-started offers are excluded.
 */
export async function getLiveOffers(now = new Date()) {
  try {
    await connectDB();
    const docs = await Offer.find({
      active: true,
      endsAt: { $gte: now },
      $or: [
        { startsAt: { $exists: false } },
        { startsAt: null },
        { startsAt: { $lte: now } },
      ],
    })
      .sort({ endsAt: 1 })
      .lean();
    return JSON.parse(JSON.stringify(docs));
  } catch (err) {
    console.error("Failed to load live offers:", err?.message || err);
    return [];
  }
}

/** Every offer, including expired/paused ones. Admin only. */
export async function getAllOffers() {
  try {
    await connectDB();
    const docs = await Offer.find().sort({ createdAt: -1 }).lean();
    return JSON.parse(JSON.stringify(docs));
  } catch (err) {
    console.error("Failed to load offers:", err?.message || err);
    return [];
  }
}
