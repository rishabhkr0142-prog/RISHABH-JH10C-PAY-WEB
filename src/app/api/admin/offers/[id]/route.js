import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Offer from "@/models/Offer";

export const dynamic = "force-dynamic";

const OBJECT_ID = /^[a-f\d]{24}$/i;

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * PUT /api/admin/offers/:id — edit an offer. Admin only.
 * Admins can edit expired offers too (e.g. to extend the end time).
 */
export async function PUT(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const id = params?.id;
    if (!id || !OBJECT_ID.test(id)) {
      return NextResponse.json({ error: "Invalid offer id." }, { status: 400 });
    }

    const existing = await Offer.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    const body = await request.json();
    const updates = {};

    if (body?.title !== undefined) {
      const title = String(body.title || "").trim();
      if (!title) {
        return NextResponse.json({ error: "Offer title is required." }, { status: 400 });
      }
      updates.title = title;
    }

    if (body?.description !== undefined) updates.description = String(body.description || "").trim();
    if (body?.badge !== undefined) {
      updates.badge = String(body.badge || "").trim() || "LIMITED TIME";
    }
    if (body?.discountLabel !== undefined) {
      updates.discountLabel = String(body.discountLabel || "").trim();
    }
    if (body?.discountType !== undefined) {
      updates.discountType = body.discountType === "fixed" ? "fixed" : "percent";
    }
    if (body?.discountValue !== undefined) {
      updates.discountValue = Math.max(0, Number(body.discountValue) || 0);
    }
    if (body?.couponCode !== undefined) {
      updates.couponCode = String(body.couponCode || "").trim().toUpperCase();
    }
    if (body?.productName !== undefined) updates.productName = String(body.productName || "").trim();
    if (body?.imageUrl !== undefined) updates.imageUrl = String(body.imageUrl || "").trim();
    if (body?.productId !== undefined) {
      updates.productId =
        body.productId && OBJECT_ID.test(String(body.productId)) ? body.productId : null;
    }

    let nextStartsAt = existing.startsAt;
    let nextEndsAt = existing.endsAt;

    if (body?.startsAt !== undefined) {
      const parsed = parseDate(body.startsAt);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid start time." }, { status: 400 });
      }
      nextStartsAt = parsed;
      updates.startsAt = parsed;
    }

    if (body?.endsAt !== undefined) {
      const parsed = parseDate(body.endsAt);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid end time." }, { status: 400 });
      }
      nextEndsAt = parsed;
      updates.endsAt = parsed;
    }

    if (nextStartsAt && nextEndsAt && new Date(nextEndsAt) <= new Date(nextStartsAt)) {
      return NextResponse.json(
        { error: "Offer end time must be after the start time." },
        { status: 400 }
      );
    }

    if (body?.active !== undefined) updates.active = Boolean(body.active);

    const offer = await Offer.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).lean();

    revalidatePath("/");
    revalidatePath("/admin/offers");

    return NextResponse.json({ ok: true, offer: JSON.parse(JSON.stringify(offer)) });
  } catch (err) {
    console.error("PUT /api/admin/offers/[id]:", err);
    return NextResponse.json({ error: "Could not update offer." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/offers/:id — permanently delete an offer. Admin only.
 */
export async function DELETE(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const id = params?.id;
    if (!id || !OBJECT_ID.test(id)) {
      return NextResponse.json({ error: "Invalid offer id." }, { status: 400 });
    }

    const deleted = await Offer.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Offer not found or already deleted." }, { status: 404 });
    }

    revalidatePath("/");
    revalidatePath("/admin/offers");

    return NextResponse.json({ ok: true, deleted: { _id: String(deleted._id) } });
  } catch (err) {
    console.error("DELETE /api/admin/offers/[id]:", err);
    return NextResponse.json({ error: "Could not delete offer." }, { status: 500 });
  }
}
