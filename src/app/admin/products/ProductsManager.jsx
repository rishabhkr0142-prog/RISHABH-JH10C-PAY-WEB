"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import ProductForm from "./ProductForm";
import { formatPrice } from "@/lib/format";

export default function ProductsManager({ products = [] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleToggleActive = async (product) => {
    setBusyId(product._id);
    setError("");
    const newStatus = product.active !== undefined ? !product.active : !product.available;
    try {
      const res = await fetch(`/api/admin/products/${product._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      setToast({
        type: "success",
        message: `Product status updated to ${newStatus ? "Active" : "Inactive"}.`,
      });
      router.refresh();
    } catch (err) {
      const msg = err.message || "Failed to update status.";
      setError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (product) => {
    setConfirmModal({
      title: `Permanently Delete "${product.name}"?`,
      message:
        "This will permanently delete the product from the MongoDB database. It will not come back automatically. Existing orders referencing this product will be preserved. This action cannot be undone.",
      onConfirm: async () => {
        setConfirmModal(null);
        setBusyId(product._id);
        setError("");
        try {
          const res = await fetch(`/api/admin/products/${product._id}`, {
            method: "DELETE",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || "Failed to delete product from database");
          }
          setToast({
            type: "success",
            message: `"${product.name}" permanently deleted from MongoDB.`,
          });
          router.refresh();
        } catch (err) {
          const msg = err.message || "Failed to delete product.";
          setError(msg);
          setToast({ type: "error", message: msg });
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Alert Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            className={`fixed top-20 right-6 z-50 flex max-w-md items-center gap-3 rounded-xl border p-4 shadow-2xl backdrop-blur-md text-xs font-semibold ${
              toast.type === "success"
                ? "border-emerald-500/40 bg-[#06150b]/95 text-emerald-300"
                : "border-red-500/40 bg-[#160505]/95 text-red-300"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                toast.type === "success"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {toast.type === "success" ? "✓" : "!"}
            </span>
            <span className="flex-1 leading-relaxed">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-neutral-400 hover:text-white transition"
              title="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Store Catalog</h2>
          <p className="mt-1 text-xs text-neutral-400">
            {products.length} product{products.length === 1 ? "" : "s"} listed in MongoDB
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="btn-primary !text-xs font-semibold"
        >
          + Add New Product
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Products Table */}
      {products.length === 0 ? (
        <div className="glass p-12 text-center text-neutral-400">
          <p className="text-xs">No products in the store catalog yet.</p>
          <button
            onClick={() => setEditing("new")}
            className="btn-primary mt-4 !text-xs"
          >
            Create Your First Product
          </button>
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme-border/50 text-neutral-400">
                  <th className="p-4 font-medium">Product</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Price</th>
                  <th className="p-4 font-medium">Stock</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {products.map((p) => {
                  const isActive = p.active !== undefined ? p.active : p.available;
                  const isBusy = busyId === p._id;
                  const imageSrc =
                    p.imageUrl || (p.images && p.images[0]) || null;

                  return (
                    <tr key={p._id} className="transition hover:bg-white/5">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-theme-border bg-black">
                            {imageSrc ? (
                              <Image
                                src={imageSrc}
                                alt={p.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center font-mono text-xs font-bold text-neutral-500">
                                {p.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{p.name}</p>
                            <p className="font-mono text-[10px] text-neutral-500">
                              /{p.slug || p._id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="badge-theme px-2 py-0.5 text-[10px]">
                          {p.category || "General"}
                        </span>
                      </td>
                      <td
                        className="p-4 font-mono font-bold"
                        style={{ color: "var(--accent-primary)" }}
                      >
                        {p.plans && p.plans.length > 0 ? (
                          <div>
                            <div>{formatPrice(Math.min(...p.plans.map((x) => x.price)))}</div>
                            <span className="block text-[10px] text-neutral-400 font-sans font-normal">
                              {p.plans.length} plan{p.plans.length > 1 ? "s" : ""}
                            </span>
                          </div>
                        ) : (
                          formatPrice(p.price)
                        )}
                      </td>
                      <td className="p-4 font-mono text-neutral-300">
                        {p.stock !== undefined ? p.stock : "∞"}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleActive(p)}
                          disabled={isBusy}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition ${
                            isActive
                              ? "border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
                              : "border border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isActive ? "bg-emerald-400" : "bg-neutral-500"
                            }`}
                          />
                          {isActive ? "Active" : "Hidden"}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditing(p)}
                            disabled={isBusy}
                            className="rounded border border-theme-border px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:bg-white/10 hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            disabled={isBusy}
                            className="rounded border border-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Edit / Add Modal */}
      <AnimatePresence>
        {editing && (
          <ProductForm
            product={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

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
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
