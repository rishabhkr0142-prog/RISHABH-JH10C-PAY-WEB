import { notFound } from "next/navigation";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { toPlainText } from "@/lib/serialize";
import { stripProductDeliveryFields } from "@/lib/delivery-content";
import {
  attachStockAvailability,
  maybeReleaseExpiredStockReservations,
} from "@/lib/product-stock";
import { resolveProductMaintenance } from "@/lib/maintenance";
import ProductDetailClient from "./ProductDetailClient";
import {
  buildPageMetadata,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_ALT,
} from "@/lib/site";
import { cloudinaryImageUrl, normalizeImageUrl } from "@/lib/image-url";

export const dynamic = "force-dynamic";

function cleanDescription(value, fallback) {
  const text = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  return text.length > 155 ? `${text.slice(0, 152).trimEnd()}...` : text;
}

export async function generateMetadata({ params }) {
  const { id } = params;
  let product = null;

  try {
    await connectDB();
    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    product = await Product.findOne(
      isObjectId ? { $or: [{ _id: id }, { slug: id }] } : { slug: id }
    ).lean();
  } catch (e) {
    return {
      title: "Product",
      robots: { index: false, follow: false },
    };
  }

  if (!product) notFound();

  const description = cleanDescription(
    product.description,
    `Buy ${product.name} with secure UPI payment, automated delivery, and order tracking on RISHABH JH10C PAY WEB.`
  );

  const rawImage = product.images?.[0] || product.imageUrl || "";
  const normalizedImage = normalizeImageUrl(rawImage);
  const hasProductImage = normalizedImage.startsWith("https://");
  const ogImage = hasProductImage
    ? cloudinaryImageUrl(normalizedImage, { width: 1200 })
    : DEFAULT_OG_IMAGE;

  return buildPageMetadata({
    title: product.name,
    description,
    path: `/products/${product.slug || String(product._id)}`,
    image: ogImage,
    imageAlt: hasProductImage
      ? `${product.name} product image`
      : DEFAULT_OG_IMAGE_ALT,
  });
}

export default async function ProductDetailPage({ params, searchParams }) {
  const { id } = params;
  const initialCouponCode = String(searchParams?.code || "").trim();
  let product = null;

  try {
    await connectDB();
    await maybeReleaseExpiredStockReservations();
    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const doc = await Product.findOne(
      isObjectId ? { $or: [{ _id: id }, { slug: id }] } : { slug: id }
    ).lean();

    if (doc) {
      const withStock = await attachStockAvailability(toPlainText(doc));
      const stripped = stripProductDeliveryFields(withStock);
      const maintenance = await resolveProductMaintenance(stripped);
      product = {
        ...stripped,
        inMaintenance: maintenance.inMaintenance,
        maintenanceReason: maintenance.reason,
        maintenanceSource: maintenance.source,
        maintenanceUntil: maintenance.maintenanceUntil,
        maintenanceSince: maintenance.maintenanceSince,
      };
    }
  } catch (err) {
    console.error("Product detail error:", err?.message || err);
  }

  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} initialCouponCode={initialCouponCode} />;
}
