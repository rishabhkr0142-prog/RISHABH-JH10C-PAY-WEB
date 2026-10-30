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
 * PUT /api/admin/products/:id — edit a product
 */
export async function PUT(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const id = params?.id;
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
    }

    const body = await request.json();
    const updates = {};

    if (body?.name !== undefined) {
      if (!String(body.name).trim()) {
        return NextResponse.json({ error: "Product name is required." }, { status: 400 });
      }
      updates.name = String(body.name).trim();
    }

    if (body?.slug !== undefined && String(body.slug).trim()) {
      const newSlug = slugify(body.slug);
      const existing = await Product.findOne({ slug: newSlug, _id: { $ne: id } });
      if (existing) {
        return NextResponse.json({ error: "Product slug already exists." }, { status: 400 });
      }
      updates.slug = newSlug;
    }

    if (body?.description !== undefined) {
      updates.description = String(body.description).trim();
    }

    if (body?.category !== undefined) {
      updates.category = String(body.category).trim() || "General";
    }

    if (body?.price !== undefined) {
      const numericPrice = Number(body.price);
      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return NextResponse.json({ error: "Price must be a positive number." }, { status: 400 });
      }
      updates.price = numericPrice;
    }

    if (body?.stock !== undefined) {
      updates.stock = Math.max(0, Number(body.stock) || 0);
    }

    if (body?.imageUrl !== undefined) {
      const url = String(body.imageUrl).trim();
      updates.imageUrl = url;
      if (url && (!body.images || body.images.length === 0)) {
        updates.images = [url];
      }
    }

    if (body?.images !== undefined) {
      const parsedImages = Array.isArray(body.images)
        ? body.images.map((i) => String(i).trim()).filter(Boolean)
        : String(body.images || "")
            .split("\n")
            .map((i) => i.trim())
            .filter(Boolean);
      updates.images = parsedImages;
      if (parsedImages.length > 0 && !updates.imageUrl) {
        updates.imageUrl = parsedImages[0];
      }
    }

    if (body?.features !== undefined) {
      updates.features = Array.isArray(body.features)
        ? body.features.map((f) => String(f).trim()).filter(Boolean)
        : String(body.features || "")
            .split("\n")
            .map((f) => f.trim())
            .filter(Boolean);
    }

    if (body?.plans !== undefined) {
      updates.plans = Array.isArray(body.plans)
        ? body.plans
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
    }

    if (body?.active !== undefined) {
      updates.active = Boolean(body.active);
      updates.available = Boolean(body.active);
    } else if (body?.available !== undefined) {
      updates.available = Boolean(body.available);
      updates.active = Boolean(body.available);
    }

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    revalidatePath("/admin/products");

    return NextResponse.json({ ok: true, product: JSON.parse(JSON.stringify(product)) });
  } catch (err) {
    console.error("PUT /api/admin/products/[id]:", err);
    return NextResponse.json({ error: "Could not update product." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/products/:id — delete a product.
 */
export async function DELETE(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const id = params?.id;
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
    }

    const deleted = await Product.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin/products");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/products/[id]:", err);
    return NextResponse.json({ error: "Could not delete product." }, { status: 500 });
  }
}
