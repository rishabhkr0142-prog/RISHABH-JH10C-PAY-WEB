import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { getCouponOffer } from "@/lib/offers";
import { calculateDiscount, getOfferDiscountConfig } from "@/lib/offer-utils";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/offers/validate — check a coupon code for a product and return
 * the discounted price. The price is always recomputed from the database,
 * never taken from the client.
 */
export async function POST(request) {
  try {
    // Prevent coupon-code brute forcing (20 attempts per minute per IP).
    const forwarded = request.headers.get("x-forwarded-for") || "";
    const ip = forwarded.split(",")[0].trim() || "unknown";
    const rl = rateLimit(`coupon_validate_${ip}`, 20, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many coupon attempts. Please wait a minute." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const code = String(body?.code || "").trim();
    const productId = String(body?.productId || "").trim();

    if (!code) {
      return NextResponse.json({ error: "Please enter a coupon code." }, { status: 400 });
    }

    if (!/^[a-f\d]{24}$/i.test(productId)) {
      return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    }

    await connectDB();
    const product = await Product.findById(productId).lean();
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    // Resolve the same price the order API will charge.
    let unitPrice = Number(product.price) || 0;
    if (Array.isArray(product.plans) && product.plans.length > 0) {
      const planId = String(body?.planId || "").trim();
      const planLabel = String(body?.planLabel || "").trim().toLowerCase();
      const planDays =
        body?.planDays !== undefined && body?.planDays !== null
          ? Number(body.planDays)
          : null;

      let matchedPlan = null;
      if (planId) {
        matchedPlan = product.plans.find(
          (p) => String(p._id) === planId || String(p.label).trim().toLowerCase() === planId.toLowerCase()
        );
      }
      if (!matchedPlan && planLabel) {
        matchedPlan = product.plans.find(
          (p) => String(p.label).trim().toLowerCase() === planLabel
        );
      }
      if (!matchedPlan && planDays !== null) {
        matchedPlan = product.plans.find((p) => Number(p.days) === planDays);
      }
      if (!matchedPlan) {
        matchedPlan = product.plans.reduce(
          (min, p) => (Number(p.price) < Number(min.price) ? p : min),
          product.plans[0]
        );
      }
      unitPrice = Number(matchedPlan.price) || 0;
    }

    const offer = await getCouponOffer(code, productId);
    if (!offer) {
      return NextResponse.json(
        { error: "Invalid or expired coupon code." },
        { status: 404 }
      );
    }

    const discount = calculateDiscount(unitPrice, offer);
    if (discount <= 0) {
      return NextResponse.json(
        { error: "This coupon cannot be applied to this product." },
        { status: 400 }
      );
    }

    const { type, value } = getOfferDiscountConfig(offer);

    return NextResponse.json({
      ok: true,
      code: offer.couponCode,
      title: offer.title,
      discountLabel: offer.discountLabel,
      discountType: type,
      discountValue: value,
      originalPrice: unitPrice,
      discount,
      finalPrice: Math.round((unitPrice - discount) * 100) / 100,
    });
  } catch (err) {
    console.error("POST /api/offers/validate failed:", err);
    return NextResponse.json(
      { error: "Could not validate coupon. Please try again." },
      { status: 500 }
    );
  }
}
