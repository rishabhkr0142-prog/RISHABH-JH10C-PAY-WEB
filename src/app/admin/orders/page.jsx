import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Payment from "@/models/Payment";
import { toPlainText } from "@/lib/serialize";
import OrdersManager from "./OrdersManager";

/**
 * ADMIN /admin/orders — record and manage orders and incoming automated UPI payments.
 */
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await connectDB();
  const [orders, products, payments] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).lean(),
    Product.find().sort({ name: 1 }).lean(),
    Payment.find().sort({ receivedAt: -1 }).lean(),
  ]);

  return (
    <OrdersManager
      orders={toPlainText(orders)}
      products={toPlainText(products)}
      payments={toPlainText(payments)}
    />
  );
}
