"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PRODUCT_KEYS, PRODUCT_LABELS } from "@/lib/product-keys";
import ImageUploadField from "@/components/ImageUploadField";

export default function ProductForm({ product, onClose }) {
  const isEdit = Boolean(product);
  const router = useRouter();

  const [form, setForm] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    productKey: product?.productKey || "",
    deliveryType: product?.deliveryType || "license",
    deliveryTitle: product?.deliveryTitle || "",
    deliveryLink: product?.deliveryLink || "",
    deliveryMessage: product?.deliveryMessage || "",
    deliveryButtonLabel: product?.deliveryButtonLabel || "",
    useStockItems: product?.useStockItems ?? false,
    stockItems: product?.stockItems?.join("\n") || "",
    category: product?.category || "Tools",
    price: product?.price ?? "",
    description: product?.description || "",
    imageUrl: product?.imageUrl || (product?.images && product.images[0]) || "",
    imagePublicId: product?.imagePublicId || "",
    stock: product?.stock ?? 10,
    stockMode: product?.stockMode || "unlimited",
    outOfStock: product?.outOfStock ?? false,
    features: product?.features ? product.features.join("\n") : "",
    active: product?.active ?? product?.available ?? true,
    plans:
      product?.plans && product.plans.length > 0
        ? product.plans.map((p) => ({
            _id: p._id,
            label: p.label || "",
            days: p.days ?? 0,
            price: p.price ?? "",
            stockMode: p.stockMode || "unlimited",
            stock: p.stock ?? 10,
            outOfStock: p.outOfStock ?? false,
            deliveryTitle: p.deliveryTitle || "",
            deliveryLink: p.deliveryLink || "",
            deliveryMessage: p.deliveryMessage || "",
            deliveryButtonLabel: p.deliveryButtonLabel || "",
          }))
        : [],
  });

  const isContent = form.deliveryType === "content";

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
            stockMode: "unlimited",
            stock: 10,
            outOfStock: false,
            deliveryTitle: "",
            deliveryLink: "",
            deliveryMessage: "",
            deliveryButtonLabel: "",
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

    if (isContent && !form.deliveryLink.trim() && !form.deliveryMessage.trim()) {
      setError("Content products need a delivery link or delivery message.");
      setSaving(false);
      return;
    }

    if (
      isContent &&
      form.deliveryLink.trim() &&
      !/^https?:\/\//i.test(form.deliveryLink.trim())
    ) {
      setError("Delivery link must start with http:// or https://.");
      setSaving(false);
      return;
    }

    if (form.deliveryType === "license" && !form.productKey) {
      setError("Select a license app (uid/lib) for license products.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        ...form,
        price: Number(form.price),
        stockMode: form.stockMode || "unlimited",
        stock: Number(form.stock),
        outOfStock: Boolean(form.outOfStock),
        useStockItems: isContent && form.useStockItems,
        stockItems: isContent && form.useStockItems ? form.stockItems : "",
        plans: form.plans.map((p) => {
          const d = Math.max(0, Number(p.days) || 0);
          return {
            ...(p._id ? { _id: p._id } : {}),
            days: d,
            label: (p.label || "").trim() || (d === 0 ? "Lifetime" : `${d} Days`),
            price: Math.max(0, Number(p.price) || 0),
            stockMode: p.stockMode || "unlimited",
            stock: p.stock !== undefined ? Math.max(0, Number(p.stock) || 0) : 10,
            outOfStock: Boolean(p.outOfStock),
            deliveryTitle: isContent ? p.deliveryTitle || "" : "",
            deliveryLink: isContent ? p.deliveryLink || "" : "",
            deliveryMessage: isContent ? p.deliveryMessage || "" : "",
            deliveryButtonLabel: isContent ? p.deliveryButtonLabel || "" : "",
          };
        }),
        features: form.features
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        images: form.imageUrl ? [form.imageUrl.trim()] : [],
        imagePublicId: form.imagePublicId || "",
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

          <div>
            <label className="label">Delivery Type</label>
            <select
              value={form.deliveryType}
              onChange={set("deliveryType")}
              className="input"
            >
              <option value="license">License key (auth panel)</option>
              <option value="content">Content / details (no license)</option>
            </select>
            <p className="mt-1 text-[11px] text-neutral-500">
              License products generate a key after payment. Content products
              deliver the title, link, message, and optional unique stock item
              below.
            </p>
          </div>

          {form.deliveryType === "license" ? (
            <div>
              <label className="label">License App (auth panel)</label>
              <select
                value={form.productKey}
                onChange={set("productKey")}
                className="input"
              >
                <option value="">Select a license app...</option>
                {PRODUCT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PRODUCT_LABELS[key] || key} ({key})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-neutral-500">
                Choose which auth-panel app generates keys for this product. UID Bypass
                and LIB Bypass must use different apps.
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Default Delivery Content
                </h4>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  Plans can override any field below. At least a link or message
                  is required.
                </p>
              </div>

              <div>
                <label className="label">Delivery Title</label>
                <input
                  type="text"
                  value={form.deliveryTitle}
                  onChange={set("deliveryTitle")}
                  placeholder="e.g. Your WhatsApp Number"
                  className="input"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="label">Delivery Link (optional)</label>
                <input
                  type="url"
                  value={form.deliveryLink}
                  onChange={set("deliveryLink")}
                  placeholder="https://..."
                  className="input"
                  maxLength={2000}
                />
              </div>

              <div>
                <label className="label">Delivery Message</label>
                <textarea
                  rows={4}
                  value={form.deliveryMessage}
                  onChange={set("deliveryMessage")}
                  placeholder={"Order details / instructions...\nLine breaks are preserved."}
                  className="input resize-y"
                  maxLength={5000}
                />
              </div>

              <div>
                <label className="label">Button Label</label>
                <input
                  type="text"
                  value={form.deliveryButtonLabel}
                  onChange={set("deliveryButtonLabel")}
                  placeholder="Open Link"
                  className="input"
                  maxLength={80}
                />
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="product-use-stock-items"
                    checked={form.useStockItems}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        useStockItems: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-white focus:ring-0"
                  />
                  <label
                    htmlFor="product-use-stock-items"
                    className="text-xs font-medium text-neutral-300"
                  >
                    Unique stock mode (one item per order)
                  </label>
                </div>
                {form.useStockItems && (
                  <div className="mt-3">
                    <label className="label">Stock Items (one per line)</label>
                    <textarea
                      rows={4}
                      value={form.stockItems}
                      onChange={set("stockItems")}
                      placeholder={"account1:password\naccount2:password"}
                      className="input resize-y font-mono text-xs"
                    />
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Each completed order atomically claims one line. Claimed
                      items are never shown here again.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
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
              <label className="label">Stock Mode</label>
              <select
                value={form.stockMode || "unlimited"}
                onChange={set("stockMode")}
                className="input"
              >
                <option value="unlimited">Unlimited</option>
                <option value="limited">Limited</option>
              </select>
            </div>
            <div>
              <label className="label">Stock Units</label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={set("stock")}
                disabled={form.stockMode !== "limited"}
                className="input disabled:opacity-50"
              />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="product-out-of-stock"
                checked={Boolean(form.outOfStock)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, outOfStock: e.target.checked }))
                }
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-white focus:ring-0"
              />
              <label
                htmlFor="product-out-of-stock"
                className="text-xs font-medium text-neutral-300"
              >
                Mark Out of Stock (whole product)
              </label>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              Product-level stock is used when no plans exist. Duration plans
              set their own mode/stock below. Unlimited products never count down.
            </p>
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
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#111] p-2.5"
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

                    <div className="w-24 shrink-0">
                      <span className="block text-[9px] uppercase font-semibold text-neutral-400">
                        Stock Mode
                      </span>
                      <select
                        value={plan.stockMode || "unlimited"}
                        onChange={(e) =>
                          handlePlanChange(idx, "stockMode", e.target.value)
                        }
                        className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1 text-xs text-white outline-none focus:border-white"
                      >
                        <option value="unlimited">Unlimited</option>
                        <option value="limited">Limited</option>
                      </select>
                    </div>

                    <div className="w-20 shrink-0">
                      <span className="block text-[9px] uppercase font-semibold text-neutral-400">
                        Stock
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={plan.stock ?? 10}
                        disabled={plan.stockMode !== "limited"}
                        onChange={(e) => handlePlanChange(idx, "stock", e.target.value)}
                        className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1 text-xs font-mono text-neutral-300 outline-none focus:border-white disabled:opacity-40"
                      />
                    </div>

                    <div className="w-20 shrink-0 pt-4">
                      <label className="flex items-center gap-1 text-[10px] font-medium text-neutral-400">
                        <input
                          type="checkbox"
                          checked={Boolean(plan.outOfStock)}
                          onChange={(e) =>
                            handlePlanChange(idx, "outOfStock", e.target.checked)
                          }
                          className="h-3.5 w-3.5 rounded border-neutral-700 bg-neutral-900 text-white focus:ring-0"
                        />
                        Out of stock
                      </label>
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

                    {isContent && (
                      <div className="w-full space-y-2 border-t border-white/10 pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                          Plan Delivery Override (optional)
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            type="text"
                            value={plan.deliveryTitle || ""}
                            onChange={(e) =>
                              handlePlanChange(idx, "deliveryTitle", e.target.value)
                            }
                            placeholder="Title override (blank = product default)"
                            className="w-full rounded border border-white/15 bg-black px-2 py-1.5 text-xs text-white outline-none focus:border-white"
                            maxLength={200}
                          />
                          <input
                            type="url"
                            value={plan.deliveryLink || ""}
                            onChange={(e) =>
                              handlePlanChange(idx, "deliveryLink", e.target.value)
                            }
                            placeholder="Link override (https://...)"
                            className="w-full rounded border border-white/15 bg-black px-2 py-1.5 text-xs text-white outline-none focus:border-white"
                            maxLength={2000}
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={plan.deliveryMessage || ""}
                          onChange={(e) =>
                            handlePlanChange(idx, "deliveryMessage", e.target.value)
                          }
                          placeholder="Message override (blank = product default)"
                          className="w-full resize-y rounded border border-white/15 bg-black px-2 py-1.5 text-xs text-white outline-none focus:border-white"
                          maxLength={5000}
                        />
                        <input
                          type="text"
                          value={plan.deliveryButtonLabel || ""}
                          onChange={(e) =>
                            handlePlanChange(
                              idx,
                              "deliveryButtonLabel",
                              e.target.value
                            )
                          }
                          placeholder="Button label override"
                          className="w-full rounded border border-white/15 bg-black px-2 py-1.5 text-xs text-white outline-none focus:border-white"
                          maxLength={80}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Product Image</label>
            <ImageUploadField
              value={form.imageUrl}
              onChange={(url, publicId) =>
                setForm((f) => ({
                  ...f,
                  imageUrl: url,
                  imagePublicId: publicId || "",
                }))
              }
              folder="rishabh-jh10c/products"
              alt={form.name || "Product image preview"}
              fallbackText={form.name}
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
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
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
