"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Lightweight single-line promotional strip for the homepage.
 * Renders ONLY when active, unexpired offers exist.
 */
export default function OffersBanner({ count: initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    let isMounted = true;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/offers/count", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.count === "number") {
            setCount(data.count);
          }
        }
      } catch {}
    };

    const handleUpdate = () => fetchCount();
    window.addEventListener("offers-updated", handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("offers-updated", handleUpdate);
    };
  }, []);

  if (!count || count <= 0) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-8">
      <Link
        href="/offers"
        className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent p-4 text-xs sm:text-sm text-neutral-200 shadow-lg shadow-amber-500/5 transition hover:border-amber-400/60 hover:bg-amber-500/20 active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base select-none shrink-0">🔥</span>
          <p className="truncate text-xs sm:text-sm">
            <span className="font-bold text-white">
              {count} limited time offer{count > 1 ? "s" : ""} chal rahe hain
            </span>
            <span className="hidden text-neutral-400 min-[520px]:inline">
              {" "}· Grab exclusive discounts & coupons
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 font-bold text-amber-400 transition group-hover:text-amber-300">
          <span>Dekho</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </div>
      </Link>
    </div>
  );
}
