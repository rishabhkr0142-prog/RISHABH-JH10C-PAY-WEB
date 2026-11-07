import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Offer from "@/models/Offer";
import { normalizeOfferImageUrl } from "@/lib/image-url";

export const dynamic = "force-dynamic";

const OBJECT_ID = /^[a-f\d]{24}$/i;

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  await connectDB();
  const offers = await Offer.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({ ok: true, offers: JSON.parse(JSON.stringify(offers)) });
}

/**
 * POST /api/admin/offers — create a time-limited offer. Admin only.
 */
export async function POST(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const body = await request.json();

    const title = String(body?.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Offer title is required." }, { status: 400 });
    }

    const endsAt = parseDate(body?.endsAt);
    if (!endsAt) {
      return NextResponse.json({ error: "A valid offer end time is required." }, { status: 400 });
    }

    const startsAt = parseDate(body?.startsAt) || new Date();
    if (endsAt <= startsAt) {
      return NextResponse.json(
        { error: "Offer end time must be after the start time." },
        { status: 400 }
      );
    }

    const productId =
      body?.productId && OBJECT_ID.test(String(body.productId)) ? body.productId : null;

    const rawImageUrl = String(body?.imageUrl || "").trim();
    const imageUrl = normalizeOfferImageUrl(rawImageUrl);
    if (rawImageUrl && !imageUrl) {
      return NextResponse.json(
        { error: "Image URL must be a valid public https link (or upload a file)." },
        { status: 400 }
      );
    }

    const imagePublicId = imageUrl
      ? String(body?.imagePublicId || "").trim()
      : "";

    const offer = await Offer.create({
      title,
      description: String(body?.description || "").trim(),
      badge: String(body?.badge || "LIMITED TIME").trim() || "LIMITED TIME",
      discountLabel: String(body?.discountLabel || "").trim(),
      discountType: body?.discountType === "fixed" ? "fixed" : "percent",
      discountValue: Math.max(0, Number(body?.discountValue) || 0),
      couponCode: String(body?.couponCode || "").trim().toUpperCase(),
      productId,
      productName: String(body?.productName || "").trim(),
      imageUrl,
      imagePublicId,
      startsAt,
      endsAt,
      active: body?.active !== undefined ? Boolean(body.active) : true,
    });

    revalidatePath("/");
    revalidatePath("/offers");
    revalidatePath("/admin/offers");

    return NextResponse.json({ ok: true, offer: JSON.parse(JSON.stringify(offer)) });
  } catch (err) {
    console.error("POST /api/admin/offers:", err);
    return NextResponse.json(
      { error: "Could not create offer. Please check the form and try again." },
      { status: 500 }
    );
  }
}
