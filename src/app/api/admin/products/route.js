import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Product from "@/models/Product";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * POST /api/admin/products — create a new product.
 */
export async function POST(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const body = await request.json();

    const {
      name,
      slug: customSlug,
      description = "",
      price = 0,
      category = "General",
      imageUrl = "",
      images = [],
      features = [],
      stock = 10,
      plans = [],
    } = body || {};

    const active = body?.active !== undefined ? Boolean(body.active) : body?.available !== false;

    if (!name || String(name).trim() === "") {
      return NextResponse.json({ error: "Product name is required." }, { status: 400 });
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: "Price must be a positive number." }, { status: 400 });
    }

    // Generate unique slug
    let baseSlug = customSlug ? slugify(customSlug) : slugify(name);
    if (!baseSlug) baseSlug = `product-${Date.now()}`;
    let finalSlug = baseSlug;
    let count = 1;
    while (await Product.exists({ slug: finalSlug })) {
      finalSlug = `${baseSlug}-${count++}`;
    }

    // Parse features if string
    const parsedFeatures = Array.isArray(features)
      ? features.map((f) => String(f).trim()).filter(Boolean)
      : String(features || "")
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean);

    // Parse images array
    const parsedImages = Array.isArray(images) && images.length > 0
      ? images.map((img) => String(img).trim()).filter(Boolean)
      : imageUrl
      ? [String(imageUrl).trim()]
      : [];

    const mainImageUrl = parsedImages[0] || String(imageUrl).trim();

    // Parse duration plans
    const parsedPlans = Array.isArray(plans)
      ? plans
          .filter((p) => p && typeof p === "object")
          .map((p) => {
            const days = Math.max(0, Number(p.days) || 0);
            const autoLabel = days === 0 ? "Lifetime" : `${days} Day${days > 1 ? "s" : ""}`;
            return {
              label: String(p.label || "").trim() || autoLabel,
              days,
              price: Math.max(0, Number(p.price) || 0),
              stock: p.stock !== undefined ? Math.max(0, Number(p.stock) || 0) : 10,
            };
          })
      : [];

    const product = await Product.create({
      name: String(name).trim(),
      slug: finalSlug,
      description: String(description).trim(),
      price: numericPrice,
      plans: parsedPlans,
      category: String(category).trim() || "General",
      images: parsedImages,
      imageUrl: mainImageUrl,
      features: parsedFeatures,
      stock: Math.max(0, Number(stock) || 0),
      active,
      available: active,
    });

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin/products");

    return NextResponse.json({ ok: true, product: JSON.parse(JSON.stringify(product)) });
  } catch (err) {
    console.error("POST /api/admin/products:", err);
    return NextResponse.json({ error: err.message || "Could not create product." }, { status: 500 });
  }
}
