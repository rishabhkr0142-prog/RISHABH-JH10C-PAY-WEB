import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Offer from "@/models/Offer";

export const dynamic = "force-dynamic";

/**
 * GET /api/offers/count — returns the number of active, currently live offers.
 * Used by Navbar badge and other lightweight client components.
 */
export async function GET() {
  try {
    await connectDB();
    const now = new Date();
    const count = await Offer.countDocuments({
      active: true,
      endsAt: { $gte: now },
      $or: [
        { startsAt: { $exists: false } },
        { startsAt: null },
        { startsAt: { $lte: now } },
      ],
    });
    return NextResponse.json({ count });
  } catch (err) {
    console.error("GET /api/offers/count error:", err?.message || err);
    return NextResponse.json({ count: 0 });
  }
}

