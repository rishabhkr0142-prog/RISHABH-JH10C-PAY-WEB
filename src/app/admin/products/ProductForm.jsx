"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function ProductForm({ product, onClose }) {
  const isEdit = Boolean(product);
  const router = useRouter();

  const [form, setForm] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    category: product?.category || "Tools",
    price: product?.price ?? "",
    description: product?.description || "",
    imageUrl: product?.imageUrl || (product?.images && product.images[0]) || "",
    stock: product?.stock ?? 10,
    features: product?.features ? product.features.join("\n") : "",
    active: product?.active ?? product?.available ?? true,
    plans:
      product?.plans && product.plans.length > 0
        ? product.plans.map((p) => ({
            label: p.label || "",
            days: p.days ?? 0,
            price: p.price ?? "",
            stock: p.stock ?? 10,
          }))
        : [],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const handleAddPlan = () => {
    setForm((f) => {
      const existingDays = f.plans.map((p) => Number(p.days));
      let nextDays = 30;
      if (f.plans.length === 0) nextDays = 7;
      else if (existingDays.includes(7) && !existingDays.includes(30)) nextDays = 30;
      else if (existingDays.includes(30) && !existingDays.includes(0)) nextDays = 0;
      else nextDays = (f.plans.length + 1) * 30;

      const autoLabel = nextDays === 0 ? "Lifetime" : `${nextDays} Days`;
      return {
        ...f,
        plans: [
          ...f.plans,
          {
            days: nextDays,
            label: autoLabel,
            price: f.price || 0,
            stock: 10,
          },
        ],
      };
    });
  };

  const handlePlanChange = (index, key, val) => {
    setForm((f) => {
      const updated = [...f.plans];
      const cur = { ...updated[index], [key]: val };
      if (key === "days") {
        const num = Number(val);
        cur.label = num === 0 ? "Lifetime" : `${num} Day${num === 1 ? "" : "s"}`;
      }
      updated[index] = cur;
      return { ...f, plans: updated };
    });
  };

  const handleRemovePlan = (index) => {
    setForm((f) => ({
      ...f,
      plans: f.plans.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
        plans: form.plans.map((p) => {
          const d = Math.max(0, Number(p.days) || 0);
          return {
            days: d,
            label: (p.label || "").trim() || (d === 0 ? "Lifetime" : `${d} Days`),
            price: Math.max(0, Number(p.price) || 0),
            stock: p.stock !== undefined ? Math.max(0, Number(p.stock) || 0) : 10,
          };
        }),
        features: form.features
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        images: form.imageUrl ? [form.imageUrl.trim()] : [],
      };

      const res = await fetch(
        isEdit ? `/api/admin/products/${product._id}` : "/api/admin/products",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
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
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-white/20 bg-[#0a0a0a] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-base font-bold text-white">
            {isEdit ? "Edit Product" : "New Catalog Product"}
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label">Product Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Discord Nitro 1 Year"
              className="input"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Slug / Path</label>
              <input
                type="text"
                value={form.slug}
                onChange={set("slug")}
                placeholder="discord-nitro-1y"
                className="input"
              />
            </div>
            <div>
              <label className="label">Category</label>
              <input
                type="text"
                required
                value={form.category}
                onChange={set("category")}
                placeholder="Bots, Tools, Source Code..."
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Base Price (INR)</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.price}
                onChange={set("price")}
                placeholder="499"
                className="input"
              />
            </div>
            <div>
              <label className="label">Stock Units</label>
              <input
                type="number"
                value={form.stock}
                onChange={set("stock")}
                className="input"
              />
            </div>
          </div>

          {/* Nitro-Style Duration Pricing Plans */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Plans / Duration Pricing (Nitro-Style)
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Multiple duration options (e.g. 7 Days, 30 Days, Lifetime). 0 Days = Lifetime.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddPlan}
                className="rounded border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white hover:text-black transition"
              >
                + Add Plan
              </button>
            </div>

            {form.plans.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-white/10 p-3 text-center text-[11px] text-neutral-500">
                No duration plans configured. The store will fallback to the base price above (₹{form.price || 0}).
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {form.plans.map((plan, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#111] p-2.5 sm:flex-nowrap"
                  >
                    <div className="w-20 shrink-0">
                      <span className="block text-[9px] uppercase font-semibold text-neutral-400">
                        Days (0=Life)
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={plan.days}
                        onChange={(e) => handlePlanChange(idx, "days", e.target.value)}
                        className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1 text-xs font-mono text-white outline-none focus:border-white"
                      />
                    </div>

                    <div className="flex-1 min-w-[120px]">
                      <span className="block text-[9px] uppercase font-semibold text-neutral-400">
                        Plan Label
                      </span>
                      <input
                        type="text"
                        value={plan.label}
                        onChange={(e) => handlePlanChange(idx, "label", e.target.value)}
                        placeholder={Number(plan.days) === 0 ? "Lifetime" : `${plan.days} Days`}
                        className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1 text-xs text-white outline-none focus:border-white"
                      />
                    </div>

                    <div className="w-24 shrink-0">
                      <span className="block text-[9px] uppercase font-semibold text-neutral-400">
                        Price (₹)
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={plan.price}
                        onChange={(e) => handlePlanChange(idx, "price", e.target.value)}
                        placeholder="499"
                        className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1 text-xs font-mono font-bold text-white outline-none focus:border-white"
                      />
                    </div>

                    <div className="w-16 shrink-0">
                      <span className="block text-[9px] uppercase font-semibold text-neutral-400">
                        Stock
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={plan.stock ?? 10}
                        onChange={(e) => handlePlanChange(idx, "stock", e.target.value)}
                        className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1 text-xs font-mono text-neutral-300 outline-none focus:border-white"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemovePlan(idx)}
                        className="rounded p-1 text-neutral-500 hover:bg-red-500/10 hover:text-red-400 transition"
                        title="Remove Plan"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Image URL</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={set("imageUrl")}
              placeholder="https://..."
              className="input"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={set("description")}
              placeholder="Detailed description of features and usage..."
              className="input resize-none"
            />
          </div>

          <div>
            <label className="label">Features (one per line)</label>
            <textarea
              rows={3}
              value={form.features}
              onChange={set("features")}
              placeholder="Automated instant delivery&#10;Full replacement warranty&#10;24/7 dedicated support"
              className="input resize-none font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="product-active"
              checked={form.active}
              onChange={set("active")}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-white focus:ring-0"
            />
            <label htmlFor="product-active" className="text-xs font-medium text-neutral-300">
              Active & Listed on Store Front
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-2.5 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost py-2 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary py-2 text-xs font-bold"
            >
              {saving ? "Saving..." : isEdit ? "Update Product" : "Publish Product"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
