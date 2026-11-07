import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { PRODUCT_KEYS, normalizeProductKey } from "@/lib/product-keys";
import {
  cloudinaryPublicIdFromUrl,
  normalizeImageUrl,
} from "@/lib/image-url";
import {
  parseProductDeliveryInput,
  parseProductPlans,
  parseProductStockInput,
} from "@/lib/product-input";
import {
  recordStockLog,
  replaceUnclaimedStockItems,
} from "@/lib/product-stock";

export const dynamic = "force-dynamic";

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
      plans = [],
    } = body || {};

    const active = body?.active !== undefined ? Boolean(body.active) : body?.available !== false;

    const delivery = parseProductDeliveryInput(body);
    if (!delivery.ok) {
      return NextResponse.json({ error: delivery.error }, { status: 400 });
    }

    const productKey = normalizeProductKey(body?.productKey);
    if (body?.productKey && !productKey) {
      return NextResponse.json(
        { error: `productKey must be one of: ${PRODUCT_KEYS.join(", ")}` },
        { status: 400 }
      );
    }

    if (delivery.deliveryType === "license" && !productKey) {
      return NextResponse.json(
        { error: "Select a license app (uid/lib) for license products." },
        { status: 400 }
      );
    }

    if (delivery.deliveryType === "content" && !delivery.hasDeliveryBody) {
      return NextResponse.json(
        {
          error:
            "Content products need a delivery link or delivery message.",
        },
        { status: 400 }
      );
    }

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

    // Parse and validate image URLs (always stored as permanent https links)
    const rawImages =
      Array.isArray(images) && images.length > 0
        ? images
        : imageUrl
        ? [imageUrl]
        : [];

    const parsedImages = rawImages.map(normalizeImageUrl).filter(Boolean);

    if (
      rawImages.some((img) => String(img || "").trim()) &&
      parsedImages.length === 0
    ) {
      return NextResponse.json(
        { error: "Image URL must be a valid public https link (or upload a file)." },
        { status: 400 }
      );
    }

    const mainImageUrl = parsedImages[0] || "";
    const mainImagePublicId =
      String(body?.imagePublicId || "").trim() ||
      cloudinaryPublicIdFromUrl(mainImageUrl);

    // Parse duration plans, including optional plan-level delivery overrides.
    const parsedPlans = parseProductPlans(plans);
    if (!parsedPlans.ok) {
      return NextResponse.json({ error: parsedPlans.error }, { status: 400 });
    }

    const stockFields = parseProductStockInput(body);

    const product = await Product.create({
      name: String(name).trim(),
      productKey,
      deliveryType: delivery.deliveryType,
      ...delivery.delivery,
      useStockItems: delivery.useStockItems,
      slug: finalSlug,
      description: String(description).trim(),
      price: numericPrice,
      plans: parsedPlans.plans,
      category: String(category).trim() || "General",
      images: parsedImages,
      imageUrl: mainImageUrl,
      imagePublicId: mainImagePublicId,
      imagePublicIds: mainImagePublicId ? [mainImagePublicId] : [],
      features: parsedFeatures,
      stock: stockFields.stock,
      stockMode: stockFields.stockMode,
      outOfStock: stockFields.outOfStock,
      reserved: 0,
      active,
      available: active,
    });

    if (delivery.useStockItems) {
      await replaceUnclaimedStockItems(product._id, delivery.stockItems);
    }

    if (stockFields.stockMode === "limited") {
      await recordStockLog({
        productId: product._id,
        productName: product.name,
        scope: "product",
        action: "admin_adjust",
        quantity: stockFields.stock,
        delta: stockFields.stock,
        stockBefore: 0,
        stockAfter: stockFields.stock,
        adminId: guard.session?.user?.id || "",
        note: "Initial limited stock on product creation",
      });
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin/products");

    return NextResponse.json({ ok: true, product: JSON.parse(JSON.stringify(product)) });
  } catch (err) {
    console.error("POST /api/admin/products:", err);
    if (err?.code === 11000) {
      return NextResponse.json(
        { error: "A product with this slug already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not create product. Please check the form and try again." },
      { status: 500 }
    );
  }
}
