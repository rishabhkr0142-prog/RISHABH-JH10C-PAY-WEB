import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { toPlainText } from "@/lib/serialize";
import ProductsManager from "./ProductsManager";

/**
 * ADMIN /admin/products — add / edit / delete products.
 * The list is fetched server-side; all mutations go through
 * /api/admin/products* and re-render via router.refresh().
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminProductsPage() {
  await connectDB();
  const products = toPlainText(await Product.find().sort({ createdAt: -1 }).lean());

  return <ProductsManager products={products} />;
}
