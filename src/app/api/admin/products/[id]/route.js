import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { PRODUCT_KEYS, normalizeProductKey } from "@/lib/product-keys";
import { normalizeImageUrl } from "@/lib/image-url";
import {
  parseProductDeliveryInput,
  parseProductPlans,
} from "@/lib/product-input";
import {
  maybeNotifyLowStock,
  recordStockLog,
  replaceUnclaimedStockItems,
} from "@/lib/product-stock";
import { normalizeStockMode } from "@/lib/stock";
import ProductStockItem from "@/models/ProductStockItem";

export const dynamic = "force-dynamic";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function alertThresholdValue() {
  const value = Number(process.env.LOW_STOCK_ALERT_THRESHOLD);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 3;
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
    const current = await Product.findById(id).lean();
    if (!current) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const adminId = guard.session?.user?.id || "";
    const updates = {};
    let productStockChange = null;
    let productOutOfStockChange = null;
    const planChanges = [];
    const touchesDelivery =
      body?.deliveryType !== undefined ||
      body?.productKey !== undefined ||
      body?.deliveryTitle !== undefined ||
      body?.deliveryLink !== undefined ||
      body?.deliveryMessage !== undefined ||
      body?.deliveryButtonLabel !== undefined ||
      body?.plans !== undefined ||
      body?.useStockItems !== undefined ||
      body?.stockItems !== undefined ||
      body?.stockItemsText !== undefined;

    const delivery = parseProductDeliveryInput({
      deliveryType:
        body?.deliveryType !== undefined
          ? body.deliveryType
          : current.deliveryType,
      deliveryTitle:
        body?.deliveryTitle !== undefined
          ? body.deliveryTitle
          : current.deliveryTitle,
      deliveryLink:
        body?.deliveryLink !== undefined
          ? body.deliveryLink
          : current.deliveryLink,
      deliveryMessage:
        body?.deliveryMessage !== undefined
          ? body.deliveryMessage
          : current.deliveryMessage,
      deliveryButtonLabel:
        body?.deliveryButtonLabel !== undefined
          ? body.deliveryButtonLabel
          : current.deliveryButtonLabel,
      useStockItems:
        body?.useStockItems !== undefined
          ? body.useStockItems
          : current.useStockItems,
      stockItems: body?.stockItems ?? body?.stockItemsText,
    });

    if (!delivery.ok) {
      return NextResponse.json({ error: delivery.error }, { status: 400 });
    }

    if (delivery.deliveryType === "content" && !delivery.hasDeliveryBody) {
      return NextResponse.json(
        { error: "Content products need a delivery link or delivery message." },
        { status: 400 }
      );
    }

    let finalProductKey = normalizeProductKey(current.productKey);
    if (body?.productKey !== undefined) {
      finalProductKey = normalizeProductKey(body.productKey);
      if (body.productKey && !finalProductKey) {
        return NextResponse.json(
          { error: `productKey must be one of: ${PRODUCT_KEYS.join(", ")}` },
          { status: 400 }
        );
      }
      updates.productKey = finalProductKey;
    }

    if (
      touchesDelivery &&
      delivery.deliveryType === "license" &&
      !finalProductKey
    ) {
      return NextResponse.json(
        { error: "Select a license app (uid/lib) for license products." },
        { status: 400 }
      );
    }

    updates.deliveryType = delivery.deliveryType;
    Object.assign(updates, delivery.delivery);
    updates.useStockItems = delivery.useStockItems;

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

    if (
      body?.stockMode !== undefined ||
      body?.stock !== undefined ||
      body?.outOfStock !== undefined
    ) {
      const beforeMode = normalizeStockMode(current.stockMode, "unlimited");
      const beforeStock = Math.max(0, Number(current.stock) || 0);
      const beforeOut = Boolean(current.outOfStock);

      const afterMode =
        body?.stockMode !== undefined
          ? normalizeStockMode(body.stockMode, "unlimited")
          : beforeMode;
      const afterStock =
        body?.stock !== undefined
          ? Math.max(0, Number(body.stock) || 0)
          : beforeStock;
      const afterOut =
        body?.outOfStock !== undefined
          ? Boolean(body.outOfStock)
          : beforeOut;

      updates.stockMode = afterMode;
      updates.stock = afterStock;
      updates.outOfStock = afterOut;

      if (beforeStock !== afterStock || beforeMode !== afterMode) {
        productStockChange = {
          before: beforeStock,
          after: afterStock,
          beforeMode,
          afterMode,
        };
      }
      if (beforeOut !== afterOut) {
        productOutOfStockChange = { before: beforeOut, after: afterOut };
      }
    }

    if (body?.imageUrl !== undefined) {
      const rawUrl = String(body.imageUrl).trim();
      const url = normalizeImageUrl(rawUrl);
      if (rawUrl && !url) {
        return NextResponse.json(
          { error: "Image URL must be a valid public https link (or upload a file)." },
          { status: 400 }
        );
      }
      updates.imageUrl = url;
      if (url && (!body.images || body.images.length === 0)) {
        updates.images = [url];
      }
    }

    if (body?.images !== undefined) {
      const rawImages = Array.isArray(body.images)
        ? body.images
        : String(body.images || "").split("\n");

      const parsedImages = rawImages
        .map((i) => normalizeImageUrl(i))
        .filter(Boolean);

      if (
        rawImages.some((i) => String(i || "").trim()) &&
        parsedImages.length === 0
      ) {
        return NextResponse.json(
          { error: "Image URL must be a valid public https link (or upload a file)." },
          { status: 400 }
        );
      }

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
      const parsedPlans = parseProductPlans(body.plans);
      if (!parsedPlans.ok) {
        return NextResponse.json({ error: parsedPlans.error }, { status: 400 });
      }

      const currentPlans = Array.isArray(current.plans) ? current.plans : [];
      const mergedPlans = parsedPlans.plans.map((plan) => {
        let match = plan._id
          ? currentPlans.find((item) => String(item._id) === String(plan._id))
          : null;
        if (!match) {
          match = currentPlans.find(
            (item) =>
              String(item.label || "").trim() ===
                String(plan.label || "").trim() &&
              Number(item.days) === Number(plan.days)
          );
        }

        const beforeStock = Math.max(0, Number(match?.stock) || 0);
        const beforeMode = normalizeStockMode(
          match?.stockMode,
          current.stockMode
        );
        const beforeOut = Boolean(match?.outOfStock);

        if (
          match &&
          (beforeStock !== plan.stock ||
            beforeMode !== plan.stockMode ||
            beforeOut !== Boolean(plan.outOfStock))
        ) {
          planChanges.push({
            planId: String(match._id || ""),
            planLabel: plan.label,
            beforeStock,
            afterStock: plan.stock,
            beforeMode,
            afterMode: plan.stockMode,
            beforeOut,
            afterOut: Boolean(plan.outOfStock),
            isNew: false,
          });
        } else if (!match && plan.stockMode === "limited" && plan.stock > 0) {
          planChanges.push({
            planId: "",
            planLabel: plan.label,
            beforeStock: 0,
            afterStock: plan.stock,
            beforeMode: "unlimited",
            afterMode: plan.stockMode,
            beforeOut: false,
            afterOut: Boolean(plan.outOfStock),
            isNew: true,
          });
        }

        return {
          ...plan,
          ...(plan._id || match?._id
            ? { _id: plan._id || String(match._id) }
            : {}),
          reserved: match ? Math.max(0, Number(match.reserved) || 0) : 0,
        };
      });

      updates.plans = mergedPlans;
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

    if (productStockChange) {
      const stockChanged = productStockChange.before !== productStockChange.after;
      await recordStockLog({
        productId: product._id,
        productName: product.name,
        scope: "product",
        action: stockChanged ? "admin_adjust" : "stock_mode_change",
        quantity: Math.abs(productStockChange.after - productStockChange.before),
        delta: productStockChange.after - productStockChange.before,
        stockBefore: productStockChange.before,
        stockAfter: productStockChange.after,
        reservedAfter: Math.max(0, Number(product.reserved) || 0),
        adminId,
        note: `Admin set stock mode ${productStockChange.beforeMode} -> ${productStockChange.afterMode}`,
      });

      if (
        productStockChange.afterMode === "limited" &&
        productStockChange.after <= alertThresholdValue() &&
        (productStockChange.after === 0 ||
          productStockChange.before > alertThresholdValue() ||
          productStockChange.beforeMode !== "limited")
      ) {
        await maybeNotifyLowStock({
          product,
          stockBefore: productStockChange.before,
          stockAfter: productStockChange.after,
        });
      }
    }

    if (productOutOfStockChange) {
      await recordStockLog({
        productId: product._id,
        productName: product.name,
        scope: "product",
        action: productOutOfStockChange.after
          ? "out_of_stock_on"
          : "out_of_stock_off",
        delta: 0,
        reservedAfter: Math.max(0, Number(product.reserved) || 0),
        adminId,
        note: "Admin changed product out-of-stock switch",
      });
    }

    for (const change of planChanges) {
      const updatedPlan =
        (change.planId &&
          (product.plans || []).find(
            (plan) => String(plan._id) === String(change.planId)
          )) ||
        (product.plans || []).find(
          (plan) =>
            String(plan.label || "").trim() ===
            String(change.planLabel || "").trim()
        );

      const stockChanged = change.beforeStock !== change.afterStock;
      if (stockChanged || change.beforeMode !== change.afterMode) {
        await recordStockLog({
          productId: product._id,
          productName: product.name,
          planId: String(updatedPlan?._id || change.planId || ""),
          planLabel: change.planLabel,
          scope: "plan",
          action: stockChanged ? "admin_adjust" : "stock_mode_change",
          quantity: Math.abs(change.afterStock - change.beforeStock),
          delta: change.afterStock - change.beforeStock,
          stockBefore: change.beforeStock,
          stockAfter: change.afterStock,
          reservedAfter: Math.max(0, Number(updatedPlan?.reserved) || 0),
          adminId,
          note: `Admin set plan stock mode ${change.beforeMode} -> ${change.afterMode}`,
        });

        if (
          change.afterMode === "limited" &&
          change.afterStock <= alertThresholdValue() &&
          (change.afterStock === 0 ||
            change.beforeStock > alertThresholdValue() ||
            change.beforeMode !== "limited")
        ) {
          await maybeNotifyLowStock({
            product,
            plan: updatedPlan || { label: change.planLabel },
            planLabel: change.planLabel,
            stockBefore: change.beforeStock,
            stockAfter: change.afterStock,
          });
        }
      }

      if (change.beforeOut !== change.afterOut) {
        await recordStockLog({
          productId: product._id,
          productName: product.name,
          planId: String(updatedPlan?._id || change.planId || ""),
          planLabel: change.planLabel,
          scope: "plan",
          action: change.afterOut ? "out_of_stock_on" : "out_of_stock_off",
          delta: 0,
          reservedAfter: Math.max(0, Number(updatedPlan?.reserved) || 0),
          adminId,
          note: "Admin changed plan out-of-stock switch",
        });
      }
    }

    if (body?.stockItems !== undefined || body?.stockItemsText !== undefined) {
      await replaceUnclaimedStockItems(id, delivery.stockItems);
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
      return NextResponse.json({ error: "Product not found or already deleted." }, { status: 404 });
    }

    await ProductStockItem.deleteMany({ productId: id });

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin/products");
    revalidatePath(`/products/${id}`);
    if (deleted.slug) {
      revalidatePath(`/products/${deleted.slug}`);
    }

    return NextResponse.json({
      ok: true,
      deleted: { _id: String(deleted._id), name: deleted.name },
    });
  } catch (err) {
    console.error("DELETE /api/admin/products/[id]:", err);
    return NextResponse.json(
      { error: "Could not delete product." },
      { status: 500 }
    );
  }
}
