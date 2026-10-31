import connectDB from "@/lib/db";
import Offer from "@/models/Offer";

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
