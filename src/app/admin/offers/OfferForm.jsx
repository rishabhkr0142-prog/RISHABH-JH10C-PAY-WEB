"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toDateTimeLocal } from "@/lib/offer-utils";

function defaultStart() {
  return toDateTimeLocal(new Date());
}

function defaultEnd() {
  return toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

export default function OfferForm({ offer, products = [], onClose }) {
  const isEdit = Boolean(offer);
  const router = useRouter();

  const [form, setForm] = useState({
    title: offer?.title || "",
    description: offer?.description || "",
    badge: offer?.badge || "LIMITED TIME",
    discountLabel: offer?.discountLabel || "",
    discountType: offer?.discountType || "percent",
    discountValue: offer?.discountValue ?? "",
    couponCode: offer?.couponCode || "",
    productId: offer?.productId ? String(offer.productId) : "",
    productName: offer?.productName || "",
    imageUrl: offer?.imageUrl || "",
    startsAt: toDateTimeLocal(offer?.startsAt) || defaultStart(),
    endsAt: toDateTimeLocal(offer?.endsAt) || defaultEnd(),
    active: offer?.active ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const handleProductChange = (e) => {
    const id = e.target.value;
    const product = products.find((p) => String(p._id) === id);
    setForm((f) => ({
      ...f,
      productId: id,
      productName: product ? product.name : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!form.endsAt) throw new Error("Please choose when the offer ends.");
      const startsDate = form.startsAt ? new Date(form.startsAt) : new Date();
      const endsDate = new Date(form.endsAt);
      if (endsDate <= startsDate) {
        throw new Error("Offer end time must be after the start time.");
      }

      const payload = {
        ...form,
        startsAt: startsDate.toISOString(),
        endsAt: endsDate.toISOString(),
        productId: form.productId || null,
      };

      const res = await fetch(
        isEdit ? `/api/admin/offers/${offer._id}` : "/api/admin/offers",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");

      router.refresh();
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong.");
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
            {isEdit ? "Edit Offer" : "New Time-Limited Offer"}
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
            <label className="label">Offer Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={set("title")}
              placeholder="e.g. Diwali Mega Sale"
              className="input"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Badge Text</label>
              <input
                type="text"
                value={form.badge}
                onChange={set("badge")}
                placeholder="LIMITED TIME"
                className="input"
              />
            </div>
            <div>
              <label className="label">Discount Label</label>
              <input
                type="text"
                value={form.discountLabel}
                onChange={set("discountLabel")}
                placeholder="30% OFF / ₹100 OFF"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Coupon Code (optional)</label>
            <input
              type="text"
              value={form.couponCode}
              onChange={set("couponCode")}
              placeholder="JH10C30"
              className="input font-mono uppercase"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Discount Type</label>
              <select
                value={form.discountType}
                onChange={set("discountType")}
                className="input"
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Flat amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="label">Discount Value</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discountValue}
                onChange={set("discountValue")}
                placeholder={form.discountType === "percent" ? "e.g. 30" : "e.g. 100"}
                className="input"
              />
            </div>
          </div>
          <p className="-mt-2 text-[11px] leading-relaxed text-neutral-400">
            Applied automatically when a client enters this coupon code on the product
            page. Leave the value at 0 to use the discount label instead.
          </p>

          <div>
            <label className="label">Linked Product (optional)</label>
            <select
              value={form.productId}
              onChange={handleProductChange}
              className="input"
            >
              <option value="">No product — general offer</option>
              {products.map((p) => (
                <option key={p._id} value={String(p._id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Image URL (optional)</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={set("imageUrl")}
              placeholder="https://..."
              className="input"
            />
          </div>

          <div>
            <label className="label">Short Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={set("description")}
              placeholder="What is included in this offer..."
              className="input resize-none"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Offer Window
            </h4>
            <p className="mt-0.5 text-[11px] text-neutral-400">
              The offer is visible to clients only between these times. After the end time it
              closes automatically for everyone but admins.
            </p>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Starts At</label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={set("startsAt")}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Ends At</label>
                <input
                  type="datetime-local"
                  required
                  value={form.endsAt}
                  onChange={set("endsAt")}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="offer-active"
              checked={form.active}
              onChange={set("active")}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-white focus:ring-0"
            />
            <label htmlFor="offer-active" className="text-xs font-medium text-neutral-300">
              Active (uncheck to pause the offer immediately)
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-2.5 border-t border-white/10 pt-4">
            <button type="button" onClick={onClose} className="btn-ghost py-2 text-xs">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary py-2 text-xs font-bold"
            >
              {saving ? "Saving..." : isEdit ? "Update Offer" : "Publish Offer"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
