import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { toPlainText } from "@/lib/serialize";
import { stripProductDeliveryFields } from "@/lib/delivery-content";
import {
  attachStockAvailability,
  maybeReleaseExpiredStockReservations,
} from "@/lib/product-stock";
import {
  getCategoryMaintenanceMap,
  attachMaintenanceFields,
} from "@/lib/maintenance";
import ProductsPageClient from "./ProductsPageClient";
import { buildPageMetadata } from "@/lib/site";

// Catalog is public — cache for 30s and revalidate on product changes.
export const revalidate = 30;

export const metadata = buildPageMetadata({
  title: "All Digital Products",
  description:
    "Browse every digital product and license plan available in the store. See live prices, stock status, and delivery details before ordering.",
  path: "/products",
});

export default async function ProductsPage() {
  let products = [];
  try {
    await connectDB();
    await maybeReleaseExpiredStockReservations();
    const docs = await Product.find({
      $or: [{ active: true }, { available: true }, { active: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .lean();

    const [withStock, categoryMap] = await Promise.all([
      attachStockAvailability(toPlainText(docs)),
      getCategoryMaintenanceMap(),
    ]);
    products = withStock
      .map(stripProductDeliveryFields)
      .map((p) => attachMaintenanceFields(p, categoryMap));
  } catch (err) {
    console.error("Products page fetch error:", err?.message || err);
  }

  return <ProductsPageClient initialProducts={products} />;
}
