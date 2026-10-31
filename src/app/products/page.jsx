import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { toPlainText } from "@/lib/serialize";
import ProductsPageClient from "./ProductsPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Products & Services",
  description:
    "Explore premium digital products, gaming accounts, subscriptions, and tools with instant delivery.",
};

export default async function ProductsPage() {
  let products = [];
  try {
    await connectDB();
    const docs = await Product.find({
      $or: [{ active: true }, { available: true }, { active: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .lean();

    products = toPlainText(docs);
  } catch (err) {
    console.error("Products page fetch error:", err?.message || err);
  }

  return <ProductsPageClient initialProducts={products} />;
}
