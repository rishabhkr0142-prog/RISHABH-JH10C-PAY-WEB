import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { toPlainText } from "@/lib/serialize";
import { attachAdminStockData } from "@/lib/product-stock";
import AdminPagination from "@/components/AdminPagination";
import ProductsManager from "./ProductsManager";

/**
 * ADMIN /admin/products — add / edit / delete products.
 * The list is fetched server-side; all mutations go through
 * /api/admin/products* and re-render via router.refresh().
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 100;

export default async function AdminProductsPage({ searchParams }) {
  await connectDB();

  const requested = Number(searchParams?.page);
  const page = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1;
  const total = await Product.countDocuments().catch(() => 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const products = await attachAdminStockData(
    toPlainText(
      await Product.find()
        .select(
          "name slug productKey deliveryType deliveryTitle deliveryLink deliveryMessage deliveryButtonLabel useStockItems images imageUrl imagePublicId price stockMode plans category features stock reserved outOfStock active available createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean()
    )
  );

  return (
    <div className="space-y-4">
      <ProductsManager products={products} />
      <AdminPagination
        basePath="/admin/products"
        page={safePage}
        totalPages={totalPages}
        total={total}
        label="products"
      />
    </div>
  );
}
