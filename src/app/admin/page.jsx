import Link from "next/link";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import Client from "@/models/Client";
import { toPlainText } from "@/lib/serialize";
import { formatPrice, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await connectDB();

  const [userCount, clientUserCount, legacyClientCount, orderCount, allOrders] = await Promise.all([
    User.countDocuments().catch(() => 0),
    User.countDocuments({ role: "client" }).catch(() => 0),
    Client.countDocuments().catch(() => 0),
    Order.countDocuments().catch(() => 0),
    Order.find().sort({ createdAt: -1 }).lean().catch(() => []),
  ]);

  const totalClients = clientUserCount > 0 ? clientUserCount : legacyClientCount;

  const revenue = allOrders
    .filter((o) => o.status === "completed" || o.status === "paid")
    .reduce((sum, o) => sum + (Number(o.price || o.amount) || 0), 0);

  const recentOrders = toPlainText(allOrders.slice(0, 6));

  const statusCounts = {
    pending: allOrders.filter((o) => o.status === "pending").length,
    paid: allOrders.filter((o) => o.status === "paid").length,
    completed: allOrders.filter((o) => o.status === "completed").length,
    cancelled: allOrders.filter((o) => o.status === "cancelled").length,
  };

  const totalCount = allOrders.length || 1;
  const statusPercentages = {
    pending: Math.round((statusCounts.pending / totalCount) * 100),
    paid: Math.round((statusCounts.paid / totalCount) * 100),
    completed: Math.round((statusCounts.completed / totalCount) * 100),
    cancelled: Math.round((statusCounts.cancelled / totalCount) * 100),
  };

  const cards = [
    { label: "Total Users", value: userCount, href: "/admin/users", note: "Discord members in DB" },
    { label: "Total Clients", value: totalClients, href: "/admin/clients", note: "Verified buyers" },
    { label: "Total Orders", value: orderCount, href: "/admin/orders", note: "All-time store orders" },
    { label: "Total Revenue", value: formatPrice(revenue), isPrice: true, href: "/admin/orders", note: "Completed + Paid" },
  ];

  return (
    <div className="space-y-8">
      {/* 4 Metric Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="glass glass-hover block p-5"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              {c.label}
            </span>
            <p
              className="mt-2 font-mono text-3xl font-extrabold"
              style={{ color: "var(--accent-primary)" }}
            >
              {c.isPrice ? c.value : Number(c.value).toLocaleString("en-IN")}
            </p>
            <span className="mt-1 block text-[11px] text-neutral-500">{c.note}</span>
          </Link>
        ))}
      </div>

      {/* Visual Progress Bar: Pipeline */}
      <div className="glass p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-border/50 pb-4">
          <div>
            <h2 className="text-base font-bold text-white">Order Pipeline Breakdown</h2>
            <p className="text-xs text-neutral-400">Fulfillment lifecycle across all orders</p>
          </div>
          <span className="font-mono text-xs text-neutral-400">
            {orderCount} total recorded
          </span>
        </div>

        <div className="mt-6">
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-theme-border bg-black/60">
            <div
              style={{
                width: `${Math.max(statusPercentages.completed, statusCounts.completed ? 5 : 0)}%`,
                backgroundColor: "var(--accent-primary)",
              }}
              className="transition-all duration-300"
              title={`Completed: ${statusCounts.completed}`}
            />
            <div
              style={{
                width: `${Math.max(statusPercentages.paid, statusCounts.paid ? 5 : 0)}%`,
                backgroundColor: "var(--accent-secondary)",
              }}
              className="transition-all duration-300"
              title={`Paid: ${statusCounts.paid}`}
            />
            <div
              style={{ width: `${Math.max(statusPercentages.pending, statusCounts.pending ? 5 : 0)}%` }}
              className="bg-amber-400 transition-all duration-300"
              title={`Pending: ${statusCounts.pending}`}
            />
            <div
              style={{ width: `${Math.max(statusPercentages.cancelled, statusCounts.cancelled ? 5 : 0)}%` }}
              className="bg-neutral-800 transition-all duration-300"
              title={`Cancelled: ${statusCounts.cancelled}`}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--accent-primary)" }}
              />
              <span className="text-neutral-400">Completed:</span>
              <strong className="text-white font-mono">{statusCounts.completed}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--accent-secondary)" }}
              />
              <span className="text-neutral-400">Paid:</span>
              <strong className="text-white font-mono">{statusCounts.paid}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-neutral-400">Pending:</span>
              <strong className="text-white font-mono">{statusCounts.pending}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-neutral-700" />
              <span className="text-neutral-400">Cancelled:</span>
              <strong className="text-white font-mono">{statusCounts.cancelled}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="glass p-6">
        <div className="flex items-center justify-between border-b border-theme-border/50 pb-4">
          <div>
            <h2 className="text-base font-bold text-white">Latest Orders</h2>
            <p className="text-xs text-neutral-400">Most recent customer purchases</p>
          </div>
          <Link href="/admin/orders" className="text-xs font-semibold text-neutral-300 hover:text-white">
            Manage All Orders →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="py-8 text-center text-xs text-neutral-500">No orders recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme-border/50 text-neutral-400">
                  <th className="py-2.5 font-medium">Order ID</th>
                  <th className="py-2.5 font-medium">Customer</th>
                  <th className="py-2.5 font-medium">Product</th>
                  <th className="py-2.5 font-medium">Price</th>
                  <th className="py-2.5 font-medium">Status</th>
                  <th className="py-2.5 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentOrders.map((o) => (
                  <tr key={o._id} className="transition hover:bg-white/5">
                    <td className="py-3 font-mono text-neutral-300">#{String(o._id).slice(-8)}</td>
                    <td className="py-3 text-white font-medium">{o.customerName || "Customer"}</td>
                    <td className="py-3 text-neutral-300">{o.productName || "Product"}</td>
                    <td className="py-3 font-mono font-bold text-white">{formatPrice(o.price || o.amount)}</td>
                    <td className="py-3">
                      <span className="badge-theme px-2 py-0.5 text-[10px] font-semibold uppercase">
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 text-neutral-400">{timeAgo(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
