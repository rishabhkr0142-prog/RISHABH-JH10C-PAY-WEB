"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import Reveal from "@/components/Reveal";
import { isOfferLive, formatRemaining } from "@/lib/offer-utils";

/**
 * Public "Offers" section.
 * Shows only offers that are currently live. When an offer's end time
 * passes, it disappears for clients on the next tick automatically.
 */
export default function OffersSection({ offers = [] }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const visible = useMemo(() => {
    if (!now) return offers;
    return offers.filter((offer) => isOfferLive(offer, now));
  }, [offers, now]);

  if (visible.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8" id="offers">
      <Reveal>
        <div className="section-heading">
          <h2>
            Limited Time <span className="text-gradient">Offers</span>
          </h2>
          <p>
            Grab these deals before the timer runs out — once the clock hits zero, the
            offer is closed.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((offer, index) => {
          const remaining = offer.endsAt
            ? new Date(offer.endsAt).getTime() - (now || Date.now())
            : 0;
          const href = offer.productId ? `/products/${offer.productId}` : "/products";

          return (
            <motion.article
              key={offer._id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] transition hover:border-white/25 hover:bg-[#111111]"
            >
              <div className="relative h-40 overflow-hidden border-b border-white/10 bg-black">
                {offer.imageUrl ? (
                  <Image
                    src={offer.imageUrl}
                    alt={offer.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition duration-300 group-hover:scale-105"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#111111]">
                    <span className="font-mono text-2xl font-bold text-neutral-600">
                      {(offer.title || "OFFER").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}

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

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-sm font-bold text-white">{offer.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-400">
                  {offer.description || "A limited time deal on our premium digital products."}
                </p>

                {offer.couponCode && (
                  <div className="mt-3 flex items-center gap-2 text-[11px]">
                    <span className="text-neutral-500">Code:</span>
                    <span className="rounded border border-dashed border-amber-400/40 bg-amber-500/10 px-2 py-0.5 font-mono font-bold text-amber-300">
                      {offer.couponCode}
                    </span>
                  </div>
                )}

                <div className="mt-4 rounded-lg border border-white/10 bg-black/60 p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                    Offer ends in
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-white tabular-nums">
                    {now ? formatRemaining(remaining) : "Loading timer..."}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-[11px] text-neutral-500">Auto-closes at expiry</span>
                  <Link
                    href={href}
                    className="btn-primary px-3 py-1 text-xs font-semibold"
                  >
                    Claim Offer
                  </Link>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
