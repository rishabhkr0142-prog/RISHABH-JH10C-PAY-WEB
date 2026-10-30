import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { toPlainText } from "@/lib/serialize";
import OrdersManager from "./OrdersManager";

/**
 * ADMIN /admin/orders — record and manage orders (sales made through Discord
 * DMs / UPI go here until the payment integration is live).
 */
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await connectDB();
  const [orders, products] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).lean(),
    Product.find().sort({ name: 1 }).lean(),
  ]);

  return (
    <OrdersManager
      orders={toPlainText(orders)}
      products={toPlainText(products)}
    />
  );
}
