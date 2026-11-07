"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import ProductImage from "@/components/ProductImage";
import { isOfferLive, formatRemaining } from "@/lib/offer-utils";

export default function OffersClient({ initialOffers = [] }) {
  const [now, setNow] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = async (code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // clipboard fallback
    }
  };

  // Keep only offers that are currently live
  const visibleOffers = useMemo(() => {
    if (!now) return initialOffers;
    return initialOffers.filter((offer) => isOfferLive(offer, now));
  }, [initialOffers, now]);

  // Keep navbar badge in sync if an offer expires while user is browsing
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("offers-updated"));
    }
  }, [visibleOffers.length]);

  if (visibleOffers.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0a0a0a] px-6 py-16 text-center shadow-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-2xl shadow-inner">
            🏷️
          </div>
          <h2 className="mt-5 text-xl font-bold text-white sm:text-2xl">
            Abhi koi offer nahi hai
          </h2>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-neutral-400 sm:text-sm">
            Jaldi wapas aana! Naye limited-time discounts, deals aur coupon codes jald hi yahan live honge. Tab tak hamare products check karein.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/products"
              className="btn-primary !px-5 !py-2.5 !text-xs font-semibold"
            >
              Explore Products
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-theme-border bg-theme-surface px-4 py-2 text-xs font-semibold text-neutral-300 transition hover:bg-white/5 hover:text-white"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Special Deals & Discounts
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Limited Time <span className="text-gradient">Offers</span>
        </h1>
        <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-neutral-400">
          Grab these deals before the timer runs out — once the clock hits zero, the offer is closed.
        </p>
      </div>

      {/* Grid: 3 cols on desktop, 2 cols on tablet, 1 col on mobile */}
      <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleOffers.map((offer, index) => {
          const currentTime = now || Date.now();
          const endsTime = offer.endsAt ? new Date(offer.endsAt).getTime() : 0;
          const remaining = endsTime - currentTime;
          const isEnded = remaining <= 0;

          const href = offer.productId ? `/products/${offer.productId}` : "/products";
          const claimHref = offer.couponCode
            ? `${href}?code=${encodeURIComponent(offer.couponCode)}`
            : href;

          return (
            <motion.article
              key={offer._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] transition hover:border-white/25 hover:bg-[#111111]"
            >
              {/* Image & Badges */}
              <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-white/10 bg-black">
                <ProductImage
                  src={offer.imageUrl}
                  alt={offer.title}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-300 group-hover:scale-105"
                  fallbackText={offer.title || "OFFER"}
                />

                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-black/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {offer.badge || "LIMITED TIME"}
                </span>

                {offer.discountLabel && (
                  <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black shadow-md">
                    {offer.discountLabel}
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-base font-bold text-white line-clamp-1" title={offer.title}>
                  {offer.title}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-400">
                  {offer.description || "A limited time deal on our premium digital products."}
                </p>

                {/* Coupon code with Copy button */}
                {offer.couponCode && (
                  <div className="mt-3.5 flex items-center justify-between rounded-lg border border-amber-400/20 bg-amber-500/5 px-2.5 py-1.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-neutral-400 shrink-0">Code:</span>
                      <span className="rounded border border-dashed border-amber-400/40 bg-amber-500/10 px-2 py-0.5 font-mono font-bold text-amber-300 truncate">
                        {offer.couponCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(offer.couponCode)}
                      className="flex items-center gap-1 rounded bg-white/5 hover:bg-white/10 px-2 py-1 text-[11px] font-semibold text-amber-300 transition active:scale-95 shrink-0"
                      title="Copy coupon code"
                    >
                      {copiedCode === offer.couponCode ? (
                        <>
                          <span className="text-emerald-400">✓</span> Copied!
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Countdown timer */}
                <div className="mt-4 rounded-lg border border-white/10 bg-black/60 p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                    Offer ends in
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-white tabular-nums">
                    {isEnded ? (
                      <span className="text-red-400">Offer ended</span>
                    ) : now ? (
                      formatRemaining(remaining)
                    ) : (
                      "Loading timer..."
                    )}
                  </p>
                </div>

                {/* Card footer: Claim Offer */}
                <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4">
                  <span
                    className="truncate text-[11px] text-neutral-500 max-w-[150px]"
                    title={offer.productName || "Auto-closes at expiry"}
                  >
                    {offer.productName ? `For: ${offer.productName}` : "Auto-closes at expiry"}
                  </span>
                  {isEnded ? (
                    <span className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-neutral-500 cursor-not-allowed">
                      Offer Ended
                    </span>
                  ) : (
                    <Link
                      href={claimHref}
                      className="btn-primary !px-3.5 !py-1.5 !text-xs font-semibold"
                    >
                      Claim Offer
                    </Link>
                  )}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
