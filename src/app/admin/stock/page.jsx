import Link from "next/link";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { getStockLogs } from "@/lib/product-stock";
import { toPlainText } from "@/lib/serialize";
import { getPlanStockInfo, getProductStockInfo } from "@/lib/stock";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACTION_LABELS = {
  reserve: "Reserved",
  confirm: "Sold",
  release: "Released",
  admin_adjust: "Admin adjust",
  out_of_stock_on: "Marked out of stock",
  out_of_stock_off: "Back in stock",
  stock_mode_change: "Mode changed",
};

function actionClass(action) {
  if (action === "release") return "text-sky-300 border-sky-500/30 bg-sky-950/30";
  if (action === "reserve") return "text-amber-300 border-amber-500/30 bg-amber-950/30";
  if (action === "confirm") return "text-emerald-300 border-emerald-500/30 bg-emerald-950/30";
  if (action === "out_of_stock_on") return "text-red-300 border-red-500/30 bg-red-950/30";
  return "text-neutral-300 border-neutral-700 bg-neutral-900";
}

export default async function AdminStockPage() {
  await connectDB();

  const [productsRaw, logsRaw] = await Promise.all([
    Product.find().sort({ name: 1 }).lean(),
    getStockLogs({ limit: 300 }),
  ]);

  const products = toPlainText(productsRaw);
  const logs = toPlainText(logsRaw);

  const lowStock = [];
  const outOfStock = [];

  for (const product of products) {
    const info = getProductStockInfo(product);
    const plans = Array.isArray(product.plans) ? product.plans : [];

    if (!info.inStock) {
      outOfStock.push({ product, plans: [] });
      continue;
    }

    if (plans.length > 0) {
      for (const plan of plans) {
        const planInfo = getPlanStockInfo(product, plan);
        if (
          planInfo.limited &&
          planInfo.inStock &&
          planInfo.stock > 0 &&
          planInfo.stock <= 5
        ) {
          lowStock.push({
            product,
            planLabel: plan.label || `${plan.days} Days`,
            plan,
            info: planInfo,
          });
        }
      }
    } else if (info.limited && info.stock > 0 && info.stock <= 5) {
      lowStock.push({
        product,
        planLabel: "",
        plan: null,
        info,
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Inventory Control</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Live stock, reservations and the complete audit trail. Adjust stock
            from{" "}
            <Link href="/admin/products" className="text-white underline">
              Products
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glass p-5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Products
          </span>
          <p className="mt-2 font-mono text-3xl font-extrabold text-white">
            {products.length}
          </p>
        </div>
        <div className="glass p-5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Low Stock
          </span>
          <p className="mt-2 font-mono text-3xl font-extrabold text-amber-400">
            {lowStock.length}
          </p>
        </div>
        <div className="glass p-5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Out of Stock
          </span>
          <p className="mt-2 font-mono text-3xl font-extrabold text-red-400">
            {outOfStock.length}
          </p>
        </div>
      </div>

      {(lowStock.length > 0 || outOfStock.length > 0) && (
        <div className="glass p-5">
          <h3 className="text-sm font-bold text-white">Needs attention</h3>
          <div className="mt-3 space-y-2">
            {outOfStock.map(({ product }) => (
              <div
                key={`out-${product._id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-white">{product.name}</span>
                <span className="text-red-300">Out of stock</span>
              </div>
            ))}
            {lowStock.map(({ product, planLabel, info }) => (
              <div
                key={`low-${product._id}-${planLabel}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-white">
                  {product.name}
                  {planLabel ? ` (${planLabel})` : ""}
                </span>
                <span className="text-amber-300">
                  {info.stock} left · {info.reserved} reserved
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass overflow-hidden">
        <div className="border-b border-theme-border/50 p-4">
          <h3 className="text-sm font-bold text-white">Stock History</h3>
          <p className="mt-1 text-[11px] text-neutral-400">
            Latest {logs.length} inventory movements. Reservations, sales,
            releases and admin edits are all recorded.
          </p>
        </div>

        {logs.length === 0 ? (
          <p className="p-10 text-center text-xs text-neutral-500">
            No stock movements recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme-border/50 text-neutral-400">
                  <th className="p-3 font-medium">Time</th>
                  <th className="p-3 font-medium">Product</th>
                  <th className="p-3 font-medium">Plan</th>
                  <th className="p-3 font-medium">Action</th>
                  <th className="p-3 font-medium">Change</th>
                  <th className="p-3 font-medium">Stock</th>
                  <th className="p-3 font-medium">Reference</th>
                  <th className="p-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log._id} className="transition hover:bg-white/5">
                    <td className="whitespace-nowrap p-3 text-neutral-400">
                      {timeAgo(log.createdAt)}
                    </td>
                    <td className="p-3 font-medium text-white">
                      {log.productName || String(log.productId || "").slice(-8)}
                    </td>
                    <td className="p-3 text-neutral-300">
                      {log.planLabel || "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${actionClass(
                          log.action
                        )}`}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td
                      className={`p-3 font-mono font-semibold ${
                        Number(log.delta) > 0
                          ? "text-emerald-400"
                          : Number(log.delta) < 0
                          ? "text-red-400"
                          : "text-neutral-400"
                      }`}
                    >
                      {Number(log.delta) > 0 ? "+" : ""}
                      {Number(log.delta) || 0}
                    </td>
                    <td className="p-3 font-mono text-neutral-300">
                      {log.stockBefore === null || log.stockBefore === undefined
                        ? "—"
                        : `${log.stockBefore} → ${
                            log.stockAfter === null ||
                            log.stockAfter === undefined
                              ? "?"
                              : log.stockAfter
                          }`}
                      {log.reservedAfter !== null &&
                      log.reservedAfter !== undefined ? (
                        <span className="ml-1 text-[10px] text-neutral-500">
                          ({log.reservedAfter} reserved)
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3 font-mono text-neutral-400">
                      {log.orderId ? `#${String(log.orderId).slice(-8)}` : "—"}
                    </td>
                    <td className="max-w-[220px] p-3 text-[11px] text-neutral-500">
                      {log.note || "—"}
                    </td>
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
