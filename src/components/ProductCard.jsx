"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { formatPrice } from "@/lib/format";

export default function ProductCard({ product, index = 0 }) {
  if (!product) return null;
  const imageSrc = product.imageUrl || (product.images && product.images[0]) || null;
  const inStock = product.stock === undefined || product.stock > 0;
  const isAvailable = product.active !== false && product.available !== false && inStock;

  return (
    <motion.article
      variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] transition hover:border-white/25 hover:bg-[#111111]"
      id={`product-${product._id}`}
    >
      <Link
        href={`/products/${product._id || product.slug}`}
        className="relative block h-44 overflow-hidden border-b border-white/10 bg-black"
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#111111]">
            <span className="font-mono text-xl font-bold text-neutral-600">
              {(product.name || "?").slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md border ${
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
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-sm font-bold text-white transition group-hover:underline">
          {product.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-400">
          {product.description || "Premium digital asset with automated fulfillment."}
        </p>

        <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4">
          <p className="font-mono text-base font-bold text-white">
            {formatPrice(product.price)}
          </p>
          <Link
            href={`/products/${product._id || product.slug}`}
            className="btn-primary px-3 py-1 text-xs font-semibold"
          >
            View Details
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
