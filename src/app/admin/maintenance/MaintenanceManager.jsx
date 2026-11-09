"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

function timeAgo(dateString) {
  if (!dateString) return "just now";
  const date = new Date(dateString);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function MaintenanceManager({
  initialCategories = [],
  initialProducts = [],
  initialLogs = [],
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [products, setProducts] = useState(initialProducts);
  const [logs, setLogs] = useState(initialLogs);

  // Expanded category accordions (set of normalized category names)
  const [expandedCategories, setExpandedCategories] = useState(() => {
    // Default expand all categories initially
    const set = new Set();
    initialCategories.forEach((c) => set.add(c.name.toLowerCase()));
    return set;
  });

  // Selected product IDs for bulk actions
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Category Toggle Modal State
  const [categoryModal, setCategoryModal] = useState({
    isOpen: false,
    category: null,
    reason: "",
    until: "",
    error: "",
    loading: false,
  });

  // Bulk Product Maintenance Modal State
  const [bulkModal, setBulkModal] = useState({
    isOpen: false,
    mode: "enable", // "enable" | "disable"
    reason: "",
    error: "",
    loading: false,
  });

  // Confirmation Modal for single product or category disable
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    loading: false,
  });

  // Notification Toast / Banner
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Group products by category
  const productsByCategory = useMemo(() => {
    const map = new Map();
    // Initialize map with known categories
    categories.forEach((cat) => {
      map.set(cat.name.toLowerCase(), []);
    });

    products.forEach((prod) => {
      const catKey = (prod.category || "General").trim().toLowerCase();
      if (!map.has(catKey)) {
        map.set(catKey, []);
      }
      map.get(catKey).push(prod);
    });

    return map;
  }, [categories, products]);

  // Overall stats
  const stats = useMemo(() => {
    const totalCats = categories.length;
    const catsInMaint = categories.filter((c) => c.maintenance).length;
    const totalProds = products.length;

    // A product is effectively in maintenance if it is directly in maintenance OR its category is
    const activeCatMap = new Map();
    categories.forEach((c) => {
      if (c.maintenance) activeCatMap.set(c.name.toLowerCase(), true);
    });

    const prodsInMaint = products.filter(
      (p) =>
        p.maintenance ||
        activeCatMap.has((p.category || "").trim().toLowerCase())
    ).length;

    return { totalCats, catsInMaint, totalProds, prodsInMaint };
  }, [categories, products]);

  // Toggle Category Accordion
  const toggleAccordion = (catName) => {
    const key = catName.toLowerCase();
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Category Maintenance Toggle
  const handleCategoryToggle = (category) => {
    if (category.maintenance) {
      // Disabling maintenance
      setConfirmModal({
        isOpen: true,
        title: `Remove Maintenance: "${category.name}"`,
        message: `Are you sure you want to restore "${category.name}" and all its inherited products to active live status?`,
        loading: false,
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, loading: true }));
          try {
            const res = await fetch("/api/admin/maintenance/category", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: category.name,
                maintenance: false,
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update category.");

            setCategories((prev) =>
              prev.map((c) =>
                c.name.toLowerCase() === category.name.toLowerCase()
                  ? {
                      ...c,
                      maintenance: false,
                      maintenanceReason: "",
                      maintenanceUntil: "",
                      maintenanceSince: null,
                    }
                  : c
              )
            );
            showToast(data.message || `Category "${category.name}" maintenance disabled.`);
            setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null, loading: false });
            router.refresh();
          } catch (err) {
            showToast(err.message, "error");
            setConfirmModal((prev) => ({ ...prev, loading: false }));
          }
        },
      });
    } else {
      // Enabling maintenance — requires reason
      setCategoryModal({
        isOpen: true,
        category,
        reason: "",
        until: "",
        error: "",
        loading: false,
      });
    }
  };

  // Submit Category Enable Modal
  const submitCategoryEnable = async () => {
    const reason = categoryModal.reason.trim();
    if (!reason) {
      setCategoryModal((prev) => ({
        ...prev,
        error: "Maintenance reason is required.",
      }));
      return;
    }
    if (reason.length > 200) {
      setCategoryModal((prev) => ({
        ...prev,
        error: "Reason must be 200 characters or fewer.",
      }));
      return;
    }

    setCategoryModal((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const res = await fetch("/api/admin/maintenance/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryModal.category.name,
          maintenance: true,
          reason,
          maintenanceUntil: categoryModal.until.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update category.");

      setCategories((prev) =>
        prev.map((c) =>
          c.name.toLowerCase() === categoryModal.category.name.toLowerCase()
            ? {
                ...c,
                maintenance: true,
                maintenanceReason: reason,
                maintenanceUntil: categoryModal.until.trim(),
                maintenanceSince: new Date().toISOString(),
              }
            : c
        )
      );

      showToast(data.message || `Category "${categoryModal.category.name}" is now under maintenance.`);
      setCategoryModal({
        isOpen: false,
        category: null,
        reason: "",
        until: "",
        error: "",
        loading: false,
      });
      router.refresh();
    } catch (err) {
      setCategoryModal((prev) => ({ ...prev, loading: false, error: err.message }));
    }
  };

  // Selection Logic
  const handleSelectProduct = (productId) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleSelectAllCategoryProducts = (catName, prods) => {
    const prodIds = prods.map((p) => String(p._id));
    const allSelected = prodIds.every((id) => selectedProductIds.has(id));

    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        prodIds.forEach((id) => next.delete(id));
      } else {
        prodIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedProductIds(new Set());
  };

  // Bulk Product Maintenance Action
  const openBulkModal = (mode) => {
    if (selectedProductIds.size === 0) return;
    if (mode === "disable") {
      setConfirmModal({
        isOpen: true,
        title: `Remove ${selectedProductIds.size} Products from Maintenance`,
        message: `Are you sure you want to remove ${selectedProductIds.size} product(s) from maintenance? Note: Products belonging to a category that is still under maintenance will continue to inherit category maintenance.`,
        loading: false,
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, loading: true }));
          try {
            const res = await fetch("/api/admin/maintenance/products", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productIds: Array.from(selectedProductIds),
                maintenance: false,
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update products.");

            setProducts((prev) =>
              prev.map((p) =>
                selectedProductIds.has(String(p._id))
                  ? { ...p, maintenance: false, maintenanceReason: "" }
                  : p
              )
            );
            showToast(data.message || "Products removed from maintenance.");
            setSelectedProductIds(new Set());
            setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null, loading: false });
            router.refresh();
          } catch (err) {
            showToast(err.message, "error");
            setConfirmModal((prev) => ({ ...prev, loading: false }));
          }
        },
      });
    } else {
      setBulkModal({
        isOpen: true,
        mode: "enable",
        reason: "",
        error: "",
        loading: false,
      });
    }
  };

  const submitBulkProductEnable = async () => {
    const reason = bulkModal.reason.trim();
    if (!reason) {
      setBulkModal((prev) => ({
        ...prev,
        error: "Maintenance reason is required.",
      }));
      return;
    }
    if (reason.length > 200) {
      setBulkModal((prev) => ({
        ...prev,
        error: "Reason must be 200 characters or fewer.",
      }));
      return;
    }

    setBulkModal((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const res = await fetch("/api/admin/maintenance/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: Array.from(selectedProductIds),
          maintenance: true,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update products.");

      setProducts((prev) =>
        prev.map((p) =>
          selectedProductIds.has(String(p._id))
            ? { ...p, maintenance: true, maintenanceReason: reason }
            : p
        )
      );

      showToast(data.message || "Selected products placed under maintenance.");
      setSelectedProductIds(new Set());
      setBulkModal({
        isOpen: false,
        mode: "enable",
        reason: "",
        error: "",
        loading: false,
      });
      router.refresh();
    } catch (err) {
      setBulkModal((prev) => ({ ...prev, loading: false, error: err.message }));
    }
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-semibold shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 ${
            toast.type === "error"
              ? "border-red-500/40 bg-red-950/90 text-red-200"
              : "border-emerald-500/40 bg-neutral-900/95 text-emerald-300"
          }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-neutral-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Maintenance Mode Control
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            Control store availability by Category or individual Products. Orders for items under maintenance are blocked server-side while keeping existing orders and payments intact.
          </p>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories or products..."
            className="w-full rounded-lg border border-theme-border bg-neutral-900/80 px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-white/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Total Categories
          </span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-white">
            {stats.totalCats}
          </p>
        </div>
        <div className="glass p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            Categories in Maint.
          </span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-amber-400">
            {stats.catsInMaint}
          </p>
        </div>
        <div className="glass p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Total Products
          </span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-white">
            {stats.totalProds}
          </p>
        </div>
        <div className="glass p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            Products in Maint.
          </span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-amber-400">
            {stats.prodsInMaint}
          </p>
        </div>
      </div>

      {/* Sticky Bulk Action Bar if products are selected */}
      {selectedProductIds.size > 0 && (
        <div className="sticky top-4 z-40 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-neutral-950/95 p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
              {selectedProductIds.size}
            </span>
            <span className="text-xs font-bold text-white">
              product{selectedProductIds.size > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={handleClearSelection}
              className="ml-2 text-[11px] text-neutral-400 underline hover:text-white"
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openBulkModal("enable")}
              className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20"
            >
              Put in Maintenance
            </button>
            <button
              onClick={() => openBulkModal("disable")}
              className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
            >
              Remove from Maintenance
            </button>
          </div>
        </div>
      )}

      {/* Categories & Products Tree */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const catKey = cat.name.toLowerCase();
          const allProdsInCat = productsByCategory.get(catKey) || [];

          // Filter products if search query is active
          const filteredProds = allProdsInCat.filter((p) => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
              p.name.toLowerCase().includes(q) ||
              cat.name.toLowerCase().includes(q)
            );
          });

          // Skip category if search is active and nothing matches
          if (
            searchQuery &&
            filteredProds.length === 0 &&
            !cat.name.toLowerCase().includes(searchQuery.toLowerCase())
          ) {
            return null;
          }

          const isExpanded = expandedCategories.has(catKey);
          const allSelected =
            filteredProds.length > 0 &&
            filteredProds.every((p) => selectedProductIds.has(String(p._id)));
          const someSelected =
            filteredProds.some((p) => selectedProductIds.has(String(p._id))) &&
            !allSelected;

          return (
            <div
              key={cat.name}
              className={`rounded-2xl border transition-all ${
                cat.maintenance
                  ? "border-amber-500/40 bg-amber-950/10 shadow-[0_0_20px_rgba(245,158,11,0.05)]"
                  : "border-theme-border bg-neutral-900/40"
              }`}
            >
              {/* Category Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleAccordion(cat.name)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-theme-border bg-neutral-800 text-xs text-neutral-300 transition hover:text-white"
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">
                        {cat.name}
                      </h3>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono text-neutral-300">
                        {allProdsInCat.length} product{allProdsInCat.length === 1 ? "" : "s"}
                      </span>
                      {cat.maintenance ? (
                        <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Category Maintenance ON
                        </span>
                      ) : (
                        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          Active
                        </span>
                      )}
                    </div>

                    {cat.maintenance && (
                      <p className="mt-1 text-xs text-amber-200/90">
                        <span className="font-semibold">Reason:</span>{" "}
                        {cat.maintenanceReason}
                        {cat.maintenanceUntil && (
                          <span className="ml-2 font-mono text-amber-300/80">
                            (Until: {cat.maintenanceUntil})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Category Switch Button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCategoryToggle(cat)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                      cat.maintenance
                        ? "border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                        : "btn-secondary text-neutral-300 hover:text-white"
                    }`}
                  >
                    {cat.maintenance ? "Turn OFF Maintenance" : "Turn ON Maintenance"}
                  </button>
                </div>
              </div>

              {/* Collapsible Product List */}
              {isExpanded && (
                <div className="border-t border-theme-border/60 bg-black/20 p-4 sm:p-5">
                  {/* Select All Checkbox for this Category */}
                  {filteredProds.length > 0 ? (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                      <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          onChange={() =>
                            handleSelectAllCategoryProducts(cat.name, filteredProds)
                          }
                          className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-white accent-white focus:ring-0"
                        />
                        Select all {filteredProds.length} products in {cat.name}
                      </label>

                      <span className="text-[11px] text-neutral-500">
                        {
                          filteredProds.filter((p) =>
                            selectedProductIds.has(String(p._id))
                          ).length
                        }{" "}
                        selected
                      </span>
                    </div>
                  ) : null}

                  {filteredProds.length === 0 ? (
                    <p className="py-2 text-center text-xs text-neutral-500">
                      No products found in this category.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredProds.map((prod) => {
                        const isSelected = selectedProductIds.has(String(prod._id));
                        const isCatMaint = cat.maintenance;
                        const isProdMaint = Boolean(prod.maintenance);
                        const isEffectiveMaint = isCatMaint || isProdMaint;

                        return (
                          <div
                            key={prod._id}
                            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs transition-all ${
                              isSelected
                                ? "border-white/30 bg-white/5"
                                : isEffectiveMaint
                                ? "border-amber-500/20 bg-amber-950/15"
                                : "border-theme-border/40 bg-neutral-900/30 hover:border-theme-border"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectProduct(String(prod._id))}
                                className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-white accent-white focus:ring-0"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">
                                    {prod.name}
                                  </span>
                                  {isProdMaint ? (
                                    <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                                      Product Maint
                                    </span>
                                  ) : isCatMaint ? (
                                    <span className="rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400/80">
                                      Category Maint (Inherited)
                                    </span>
                                  ) : (
                                    <span className="rounded border border-emerald-500/25 bg-emerald-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                                      Live
                                    </span>
                                  )}
                                </div>

                                {isProdMaint && prod.maintenanceReason && (
                                  <p className="mt-0.5 text-[11px] text-amber-300/80">
                                    <span className="font-semibold">Reason:</span>{" "}
                                    {prod.maintenanceReason}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Quick Single-Product Toggle */}
                              <button
                                onClick={async () => {
                                  if (isProdMaint) {
                                    // Disable product maintenance
                                    try {
                                      const res = await fetch(
                                        "/api/admin/maintenance/products",
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            productIds: [String(prod._id)],
                                            maintenance: false,
                                          }),
                                        }
                                      );
                                      const data = await res.json();
                                      if (!res.ok)
                                        throw new Error(
                                          data.error || "Failed to update product."
                                        );

                                      setProducts((prev) =>
                                        prev.map((p) =>
                                          String(p._id) === String(prod._id)
                                            ? {
                                                ...p,
                                                maintenance: false,
                                                maintenanceReason: "",
                                              }
                                            : p
                                        )
                                      );
                                      showToast(`"${prod.name}" removed from maintenance.`);
                                      router.refresh();
                                    } catch (err) {
                                      showToast(err.message, "error");
                                    }
                                  } else {
                                    // Open modal for this single product
                                    setSelectedProductIds(new Set([String(prod._id)]));
                                    setBulkModal({
                                      isOpen: true,
                                      mode: "enable",
                                      reason: "",
                                      error: "",
                                      loading: false,
                                    });
                                  }
                                }}
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                                  isProdMaint
                                    ? "border border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                                    : "border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white"
                                }`}
                              >
                                {isProdMaint ? "Remove Maint" : "Set Maint"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Audit Log Section */}
      <div className="mt-12 rounded-2xl border border-theme-border bg-neutral-900/30 p-5">
        <div className="flex items-center justify-between border-b border-theme-border pb-4">
          <div>
            <h3 className="text-base font-bold text-white">
              Maintenance Audit Trail
            </h3>
            <p className="mt-0.5 text-xs text-neutral-400">
              Immutable log of recent maintenance actions, reasons, and timestamps.
            </p>
          </div>
          <span className="font-mono text-xs text-neutral-500">
            {logs.length} logged events
          </span>
        </div>

        {logs.length === 0 ? (
          <p className="py-6 text-center text-xs text-neutral-500">
            No maintenance actions recorded yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Admin</th>
                  <th className="pb-2">Target</th>
                  <th className="pb-2">Action</th>
                  <th className="pb-2">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log, idx) => (
                  <tr key={log._id || idx} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                      {timeAgo(log.createdAt)}
                    </td>
                    <td className="py-2.5 font-medium text-white whitespace-nowrap">
                      {log.adminEmail || "Admin"}
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span className="rounded border border-white/10 bg-neutral-800 px-2 py-0.5 font-mono text-[10px] text-neutral-300">
                        {log.targetType}: {log.targetName || log.targetId}
                      </span>
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          log.action === "enable"
                            ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                            : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 text-neutral-300 max-w-xs truncate">
                      {log.reason || "—"}
                      {log.maintenanceUntil && (
                        <span className="ml-1 text-[10px] text-neutral-500">
                          (ETA: {log.maintenanceUntil})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Enable Maintenance Modal */}
      {categoryModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-neutral-950 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              Put Category Under Maintenance
            </h3>
            <p className="mt-1 text-xs text-neutral-400">
              Category:{" "}
              <span className="font-semibold text-amber-300">
                {categoryModal.category?.name}
              </span>
              . All products in this category will be blocked from checkout.
            </p>

            {categoryModal.error && (
              <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 p-2.5 text-xs text-red-300">
                {categoryModal.error}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300">
                  Maintenance Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={categoryModal.reason}
                  onChange={(e) =>
                    setCategoryModal((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="e.g. Scheduled system upgrade in progress. Back shortly."
                  maxLength={200}
                  className="mt-1 w-full rounded-lg border border-theme-border bg-neutral-900 p-2.5 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                />
                <div className="mt-0.5 text-right font-mono text-[10px] text-neutral-500">
                  {categoryModal.reason.length}/200
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300">
                  Expected Completion Time / ETA (Optional)
                </label>
                <input
                  type="text"
                  value={categoryModal.until}
                  onChange={(e) =>
                    setCategoryModal((prev) => ({
                      ...prev,
                      until: e.target.value,
                    }))
                  }
                  placeholder="e.g. Today at 8:00 PM IST or ~2 hours"
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border border-theme-border bg-neutral-900 p-2.5 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={categoryModal.loading}
                onClick={() =>
                  setCategoryModal({
                    isOpen: false,
                    category: null,
                    reason: "",
                    until: "",
                    error: "",
                    loading: false,
                  })
                }
                className="rounded-lg border border-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={categoryModal.loading}
                onClick={submitCategoryEnable}
                className="rounded-lg border border-amber-500/60 bg-amber-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
              >
                {categoryModal.loading ? "Enabling..." : "Enable Maintenance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Product Enable Modal */}
      {bulkModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-neutral-950 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              Place {selectedProductIds.size} Product(s) in Maintenance
            </h3>
            <p className="mt-1 text-xs text-neutral-400">
              Users will see this reason on the product pages and checkout will be blocked.
            </p>

            {bulkModal.error && (
              <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 p-2.5 text-xs text-red-300">
                {bulkModal.error}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-xs font-semibold text-neutral-300">
                Maintenance Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={bulkModal.reason}
                onChange={(e) =>
                  setBulkModal((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                placeholder="e.g. Stock verification / provider downtime. Available soon."
                maxLength={200}
                className="mt-1 w-full rounded-lg border border-theme-border bg-neutral-900 p-2.5 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
              />
              <div className="mt-0.5 text-right font-mono text-[10px] text-neutral-500">
                {bulkModal.reason.length}/200
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={bulkModal.loading}
                onClick={() =>
                  setBulkModal({
                    isOpen: false,
                    mode: "enable",
                    reason: "",
                    error: "",
                    loading: false,
                  })
                }
                className="rounded-lg border border-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkModal.loading}
                onClick={submitBulkProductEnable}
                className="rounded-lg border border-amber-500/60 bg-amber-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
              >
                {bulkModal.loading ? "Applying..." : "Apply Maintenance"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-theme-border bg-neutral-950 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {confirmModal.title}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-neutral-300">
              {confirmModal.message}
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={confirmModal.loading}
                onClick={() =>
                  setConfirmModal({
                    isOpen: false,
                    title: "",
                    message: "",
                    onConfirm: null,
                    loading: false,
                  })
                }
                className="rounded-lg border border-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmModal.loading}
                onClick={() => confirmModal.onConfirm && confirmModal.onConfirm()}
                className="btn-primary !px-4 !py-2 !text-xs font-bold"
              >
                {confirmModal.loading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

