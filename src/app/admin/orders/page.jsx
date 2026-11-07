import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Payment from "@/models/Payment";
import { toPlainText } from "@/lib/serialize";
import AdminPagination from "@/components/AdminPagination";
import OrdersManager from "./OrdersManager";

/**
 * ADMIN /admin/orders — record and manage orders and incoming automated UPI payments.
 * Lists are paginated server-side so MongoDB never returns the whole history.
 */
export const dynamic = "force-dynamic";

const ORDER_PAGE_SIZE = 50;
const PAYMENT_PAGE_SIZE = 50;

function pageNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function AdminOrdersPage({ searchParams }) {
  await connectDB();

  const orderPage = pageNumber(searchParams?.page);
  const paymentPage = pageNumber(searchParams?.paymentPage);

  const [ordersTotal, paymentsTotal] = await Promise.all([
    Order.countDocuments().catch(() => 0),
    Payment.countDocuments().catch(() => 0),
  ]);

  const orderPages = Math.max(1, Math.ceil(ordersTotal / ORDER_PAGE_SIZE));
  const paymentPages = Math.max(1, Math.ceil(paymentsTotal / PAYMENT_PAGE_SIZE));
  const safeOrderPage = Math.min(orderPage, orderPages);
  const safePaymentPage = Math.min(paymentPage, paymentPages);

  const [orders, products, payments] = await Promise.all([
    Order.find()
      .select("-stockReservation -stockError -licenseAttempts -deliveryAttempts")
      .sort({ createdAt: -1 })
      .skip((safeOrderPage - 1) * ORDER_PAGE_SIZE)
      .limit(ORDER_PAGE_SIZE)
      .lean(),
    Product.find()
      .select("name slug price plans productKey deliveryType stock stockMode outOfStock active available useStockItems")
      .sort({ name: 1 })
      .lean(),
    Payment.find()
      .select("utr txnId amountPaise payerUpi paidAt status archived deletedAt orderId receivedAt createdAt")
      .sort({ receivedAt: -1 })
      .skip((safePaymentPage - 1) * PAYMENT_PAGE_SIZE)
      .limit(PAYMENT_PAGE_SIZE)
      .lean(),
  ]);

  return (
    <div className="space-y-4">
      <OrdersManager
        orders={toPlainText(orders)}
        products={toPlainText(products)}
        payments={toPlainText(payments)}
      />

      <div className="glass space-y-3 p-3">
        <AdminPagination
          basePath="/admin/orders"
          page={safeOrderPage}
          totalPages={orderPages}
          total={ordersTotal}
          label="orders"
          params={{ paymentPage: safePaymentPage > 1 ? safePaymentPage : undefined }}
        />
        <AdminPagination
          basePath="/admin/orders"
          page={safePaymentPage}
          totalPages={paymentPages}
          total={paymentsTotal}
          label="payments"
          pageParam="paymentPage"
          params={{ page: safeOrderPage > 1 ? safeOrderPage : undefined }}
        />
      </div>
    </div>
  );
}
