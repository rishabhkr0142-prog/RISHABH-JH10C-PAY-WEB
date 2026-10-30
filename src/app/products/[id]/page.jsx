import { notFound } from "next/navigation";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { toPlainText } from "@/lib/serialize";
import ProductDetailClient from "./ProductDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = params;
  try {
    await connectDB();
    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const product = await Product.findOne(
      isObjectId ? { $or: [{ _id: id }, { slug: id }] } : { slug: id }
    ).lean();

    if (!product) return { title: "Product Not Found" };

    return {
      title: product.name,
      description: product.description?.slice(0, 160),
    };
  } catch (e) {
    return { title: "Product" };
  }
}

export default async function ProductDetailPage({ params }) {
  const { id } = params;
  let product = null;

  try {
    await connectDB();
    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const doc = await Product.findOne(
      isObjectId ? { $or: [{ _id: id }, { slug: id }] } : { slug: id }
    ).lean();

    if (doc) {
      product = toPlainText(doc);
    }
  } catch (err) {
    console.error("Product detail error:", err?.message || err);
  }

  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}
