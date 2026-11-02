"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "@/lib/format";
import ProductImage from "@/components/ProductImage";

export default function ProductsPageClient({ initialProducts = [] }) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = useMemo(() => {
    const set = new Set();
    initialProducts.forEach((p) => {
      if (p.category && String(p.category).trim()) {
        set.add(String(p.category).trim());
      }
    });
    if (set.size === 0) {
      return ["All", "Bots", "Source Code", "Tools", "Services"];
    }
    return ["All", ...Array.from(set)];
  }, [initialProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialProducts.filter((p) => {
      const matchCat =
        selectedCategory === "All" ||
        (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

      if (!matchCat) return false;
      if (!q) return true;

      const nameMatch = p.name?.toLowerCase().includes(q);
      const descMatch = p.description?.toLowerCase().includes(q);
      const catMatch = p.category?.toLowerCase().includes(q);
      const featureMatch = p.features?.some((f) => f.toLowerCase().includes(q));

      return nameMatch || descMatch || catMatch || featureMatch;
    });
  }, [initialProducts, search, selectedCategory]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-12 sm:px-8">
      {/* ── Page Header ── */}
      <div className="text-center">
        <span className="badge-theme px-3 py-1 text-xs font-semibold">
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--accent-primary)" }}
          />
          Verified Catalog
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Digital Products & Services
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          Hand-picked premium subscriptions, developer tools, bots, and services.
          Instant automated fulfillment with full replacement warranty.
        </p>
      </div>

      {/* ── Sticky Top Bar: Search & Category Filter Pills ── */}
      <div className="sticky top-16 z-30 mt-10 rounded-xl border border-theme-border bg-theme-surface/90 p-4 shadow-xl backdrop-blur-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, bots, tools, source code..."
              className="w-full rounded-lg border border-theme-border bg-black/60 py-2 pl-10 pr-9 text-xs text-white placeholder-neutral-500 outline-none transition focus:border-theme-border-hover focus:ring-1 focus:ring-white/20"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="text-xs text-neutral-400">
            Showing <strong className="text-white">{filteredProducts.length}</strong> of{" "}
            {initialProducts.length} products
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-theme-border/50 pt-3">
          {categories.map((cat) => {
            const active = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "btn-primary !px-3 !py-1 !text-xs font-semibold shadow-sm"
                    : "border border-theme-border bg-theme-surface text-neutral-400 hover:border-theme-border-hover hover:text-white"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Product Grid ── */}
      <div className="mt-8">
        {filteredProducts.length === 0 ? (
          <div className="glass p-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-theme-border bg-theme-surface text-neutral-400">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">No products found</h3>
            <p className="mx-auto mt-2 max-w-sm text-xs text-neutral-400">
              We couldn&apos;t find any items matching your current filters. Try searching for
              another term or selecting &ldquo;All&rdquo;.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedCategory("All");
              }}
              className="btn-ghost mt-6 text-xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {filteredProducts.map((product, idx) => {
                const inStock = product.stock === undefined || product.stock > 0;
                const isAvailable =
                  product.active !== false && product.available !== false && inStock;
                const imageSrc =
                  product.imageUrl ||
                  (product.images && product.images[0]) ||
                  null;

                const hasPlans = Array.isArray(product.plans) && product.plans.length > 0;
                const minPrice = hasPlans
                  ? Math.min(...product.plans.map((p) => Number(p.price) || 0))
                  : Number(product.price) || 0;

                return (
                  <motion.div
                    key={product._id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: idx * 0.04 }}
                    className="glass glass-hover group flex flex-col overflow-hidden"
                  >
                    {/* Image Area */}
                    <Link
                      href={`/products/${product._id || product.slug}`}
                      className="relative block aspect-[4/3] w-full overflow-hidden border-b border-theme-border bg-black"
                    >
                      <ProductImage
                        src={imageSrc}
                        alt={product.name}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        fallbackText={product.name}
                      />

                      {/* Stock badge */}
                      <div className="absolute left-3 top-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide backdrop-blur-md border ${
                            isAvailable
                              ? "border-emerald-500/30 bg-black/80 text-emerald-300"
                              : "border-neutral-700 bg-black/80 text-neutral-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isAvailable ? "bg-emerald-400" : "bg-neutral-500"
                            }`}
                          />
                          {isAvailable ? "In Stock" : "Out of Stock"}
                        </span>
                      </div>

                      {/* Category tag */}
                      {product.category && (
                        <div className="absolute right-3 top-3">
                          <span className="rounded border border-theme-border bg-black/80 px-2 py-0.5 text-[10px] font-medium text-neutral-300 backdrop-blur-md">
                            {product.category}
                          </span>
                        </div>
                      )}
                    </Link>

                    {/* Content */}
                    <div className="flex flex-1 flex-col p-5">
                      <Link
                        href={`/products/${product._id || product.slug}`}
                        className="group-hover:underline"
                      >
                        <h2 className="text-base font-bold text-white">
                          {product.name}
                        </h2>
                      </Link>

                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-400">
                        {product.description || "Premium digital asset with instant fulfillment."}
                      </p>

                      {/* Features mini preview */}
                      {product.features && product.features.length > 0 && (
                        <ul className="mt-4 space-y-1.5 border-t border-theme-border/40 pt-3">
                          {product.features.slice(0, 2).map((feat, i) => (
                            <li key={i} className="flex items-center gap-2 text-[11px] text-neutral-300">
                              <svg
                                className="h-3 w-3 shrink-0"
                                style={{ color: "var(--accent-primary)" }}
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span className="truncate">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Price & Action */}
                      <div className="mt-auto flex items-center justify-between border-t border-theme-border/40 pt-4">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                            {hasPlans ? "Starting from" : "Price"}
                          </span>
                          <p className="font-mono text-lg font-bold text-white">
                            {formatPrice(minPrice)}
                          </p>
                          {hasPlans && (
                            <span className="block text-[10px] text-neutral-400">
                              {product.plans.length} plan{product.plans.length > 1 ? "s" : ""} available
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/products/${product._id || product.slug}`}
                          className="btn-primary !px-3.5 !py-1.5 !text-xs font-medium"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
