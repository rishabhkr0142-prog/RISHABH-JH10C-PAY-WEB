"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { formatPrice, timeAgo } from "@/lib/format";

const STATUSES = ["pending", "paid", "completed", "expired", "cancelled"];

export default function OrdersManager({ orders = [], products = [] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [confirmModal, setConfirmModal] = useState(null);

  const [form, setForm] = useState({
    customerName: "",
    email: "",
    discordId: "",
    productId: "",
    quantity: 1,
    amount: "",
    status: "pending",
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not create order");
      }
      setForm({
        customerName: "",
        email: "",
        discordId: "",
        productId: "",
        quantity: 1,
        amount: "",
        status: "pending",
      });
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (order, newStatus) => {
    if (newStatus === "cancelled") {
      setConfirmModal({
        title: "Cancel Order?",
        message: `Are you sure you want to cancel order #${String(order._id).slice(-8)} for ${order.customerName || "Customer"}?`,
        onConfirm: async () => {
          setConfirmModal(null);
          await updateOrderStatus(order._id, newStatus);
        },
      });
      return;
    }

    await updateOrderStatus(order._id, newStatus);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    setBusyId(orderId);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (order) => {
    setConfirmModal({
      title: "Permanently Delete Order?",
      message: `This will remove order #${String(order._id).slice(-8)} from the database and decrement total store orders. This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        setBusyId(order._id);
        setError("");
        try {
          const res = await fetch(`/api/admin/orders/${order._id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Delete failed");
          }
          router.refresh();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = filterStatus === "all" || o.status === filterStatus;
      if (!matchStatus) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const idMatch = String(o._id).toLowerCase().includes(q);
      const nameMatch = (o.customerName || "").toLowerCase().includes(q);
      const prodMatch = (o.productName || o.product?.name || "").toLowerCase().includes(q);
      const discordMatch = (o.discordId || "").toLowerCase().includes(q);
      return idMatch || nameMatch || prodMatch || discordMatch;
    });
  }, [orders, search, filterStatus]);

  const renderBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            pending
          </span>
        );
      case "completed":
        return (
          <span
            className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: "var(--accent-primary)", color: "var(--btn-primary-text)" }}
          >
            completed
          </span>
        );
      case "paid":
        return (
          <span className="badge-theme px-2 py-0.5 text-[10px] font-semibold">
            paid
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex rounded-full border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
            expired
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
            cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-full border border-theme-border px-2 py-0.5 text-[10px] text-neutral-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Manage Store Orders</h2>
          <p className="mt-1 text-xs text-neutral-400">
            View, fulfill, modify, or manually record customer orders.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary !text-xs"
        >
          {showForm ? "Cancel Form" : "+ Record Manual Order"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Manual Order Creation Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="glass p-6 space-y-4"
          >
            <h3 className="text-sm font-bold text-white">New Manual Order Record</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Customer Name</label>
                <input
                  type="text"
                  required
                  value={form.customerName}
                  onChange={set("customerName")}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Customer Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Discord ID</label>
                <input
                  type="text"
                  value={form.discordId}
                  onChange={set("discordId")}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Product</label>
                <select
                  value={form.productId}
                  onChange={set("productId")}
                  className="input"
                >
                  <option value="">Select a product...</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({formatPrice(p.price)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amount / Price</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={set("amount")}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  value={form.status}
                  onChange={set("status")}
                  className="input"
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary !text-xs"
              >
                {saving ? "Saving..." : "Create Order Record"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Order ID, Customer, Discord ID, or Product..."
            className="w-full rounded-lg border border-theme-border bg-black/60 py-2 pl-3 pr-8 text-xs text-white placeholder-neutral-500 outline-none focus:border-theme-border-hover"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          {["all", ...STATUSES].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                filterStatus === st
                  ? "btn-primary !px-3 !py-1.5 !text-[11px]"
                  : "border border-theme-border bg-theme-surface text-neutral-400 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass p-6">
        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            No orders match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme-border/50 text-neutral-400">
                  <th className="py-3 font-medium">Order ID & UTR</th>
                  <th className="py-3 font-medium">Customer</th>
                  <th className="py-3 font-medium">Product</th>
                  <th className="py-3 font-medium">Price</th>
                  <th className="py-3 font-medium">Status & Timing</th>
                  <th className="py-3 font-medium">Time</th>
                  <th className="py-3 text-right font-medium">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.map((order) => {
                  const isBusy = busyId === order._id;
                  const isExpired = order.status === "expired" || (order.status === "pending" && order.expiresAt && new Date(order.expiresAt) <= new Date());
                  const displayStatus = isExpired ? "expired" : order.status;

                  return (
                    <tr key={order._id} className="transition hover:bg-white/5">
                      <td className="py-3 font-mono text-neutral-300">
                        <div>#{String(order._id).slice(-8)}</div>
                        {order.utr ? (
                          <div
                            className="mt-1 inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-300"
                            title="12-digit UPI UTR"
                          >
                            <span>UTR:</span> {order.utr}
                          </div>
                        ) : (
                          <span className="text-[10px] text-neutral-600 block italic mt-0.5">
                            No UTR yet
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <p className="font-semibold text-white">{order.customerName || "Customer"}</p>
                        <p className="font-mono text-[10px] text-neutral-500">
                          {order.discordId ? `Discord: ${order.discordId}` : order.email || "No ID"}
                        </p>
                      </td>
                      <td className="py-3 text-neutral-300">
                        <p className="font-semibold text-white">
                          {order.productName || order.product?.name || "Product"}
                        </p>
                        {order.plan?.label && (
                          <span className="inline-flex items-center gap-1 mt-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-300">
                            {order.plan.label} {Number(order.plan.days) > 0 ? `(${order.plan.days}d)` : "(Lifetime)"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 font-mono font-bold text-white">
                        {formatPrice(order.price || order.amount)}
                      </td>
                      <td className="py-3">
                        <div>{renderBadge(displayStatus)}</div>
                        {order.status === "pending" && order.expiresAt && !isExpired && (
                          <span className="block mt-1 font-mono text-[10px] text-neutral-400">
                            Expires: {new Date(order.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {order.paidAt && (
                          <span className="block mt-1 font-mono text-[10px] text-emerald-400">
                            Paid: {new Date(order.paidAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-neutral-400">{timeAgo(order.createdAt)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {order.status !== "paid" && order.status !== "completed" && (
                            <button
                              onClick={() => updateOrderStatus(order._id, "paid")}
                              disabled={isBusy}
                              className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500 hover:text-black transition"
                              title="Confirm payment received via UPI"
                            >
                              Mark Paid
                            </button>
                          )}
                          {order.status !== "completed" && (
                            <button
                              onClick={() => updateOrderStatus(order._id, "completed")}
                              disabled={isBusy}
                              className="rounded border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white hover:text-black transition"
                              title="Mark order delivery completed"
                            >
                              Mark Completed
                            </button>
                          )}
                          {order.status !== "cancelled" && (
                            <button
                              onClick={() => updateOrderStatus(order._id, "cancelled")}
                              disabled={isBusy}
                              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[10px] font-medium text-neutral-400 hover:text-white transition"
                              title="Cancel order"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(order)}
                            disabled={isBusy}
                            className="rounded border border-red-500/20 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 transition"
                            title="Delete order record"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="glass w-full max-w-md p-6 shadow-2xl"
            >
              <h3 className="text-base font-bold text-white">{confirmModal.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                {confirmModal.message}
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="btn-ghost !py-2 !text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="btn-primary !py-2 !text-xs font-bold"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
