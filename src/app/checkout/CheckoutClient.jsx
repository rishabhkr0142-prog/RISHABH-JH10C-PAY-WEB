"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "@/lib/format";
import { DiscordIcon } from "@/components/Navbar";

/**
 * CHECKOUT CLIENT — order summary + PAYMENT STEP STUB.
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ TODO: PAYMENT INTEGRATION                                 │
 * │                                                           │
 * │ The "Confirm & Pay" button below is intentionally a       │
 * │ placeholder. To go live, create your payment session      │
 * │ here (Stripe Checkout, Razorpay, crypto invoice, ...)     │
 * │ then on success:                                          │
 * │   1. Create an Order document in MongoDB                  │
 * │   2. Create/update a Client document                      │
 * │   3. Increment the "orders" stat                          │
 * │                                                           │
 * │ For now the button simply tells the buyer to contact      │
 * │ the owner on Discord — manual fulfillment flow.           │
 * └───────────────────────────────────────────────────────────┘
 */
export default function CheckoutClient({ product }) {
  const [paymentHint, setPaymentHint] = useState(null);
  const confirming = useState(false)[0];

  // Invalid / unknown product
  if (!product) {
    return (
      <section className="flex min-h-[75vh] items-center justify-center px-4">
        <div className="glass max-w-md p-10 text-center">
          <div className="text-5xl">🔎</div>
          <h1 className="mt-4 font-display text-2xl font-bold text-white">
            Product not found
          </h1>
          <p className="mt-2 text-slate-400">
            This product may have been removed or is temporarily unavailable.
          </p>
          <Link href="/#products" className="btn-primary mt-8">
            Back to Products
          </Link>
        </div>
      </section>
    );
  }

  const handlePayClick = () => {
    setPaymentHint(
      "Online payments are almost here! To complete this order right now, contact RISHABH JH10C on Discord and it will be delivered within minutes."
    );
    // PLACEHOLDER — replace this whole handler with your payment flow.
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-14 sm:px-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
          Secure <span className="text-gradient">Checkout</span>
        </h1>
        <p className="mt-3 text-slate-400">
          Review your order below — delivered instantly after confirmation.
        </p>
      </div>

      <div className="mt-10 grid md:grid-cols-2">
        {/* ── Product summary ── */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="glass overflow-hidden"
        >
          <div className="relative h-44 border-b border-white/10">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="400px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-purple/30 via-brand-blue/25 to-brand-cyan/25 font-display text-4xl font-extrabold text-white/70">
                {product.name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="p-6">
            <h2 className="font-display text-xl font-bold text-white">
              {product.name}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {product.description || "Premium digital product."}
            </p>
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
              <span className="text-sm uppercase tracking-widest text-slate-500">
                Total
              </span>
              <span className="text-gradient font-display text-3xl font-extrabold">
                {formatPrice(product.price)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Payment step (stub) ── */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="glass relative mt-6 flex flex-col justify-between overflow-hidden p-6 md:ml-0 md:mt-0"
        >
          <div
            aria-hidden
            className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/60 to-transparent"
          />

          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Payment Method
            </h2>

            {/* Payment provider placeholder — add Stripe/Razorpay/etc. here later */}
            <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-center">
              <div className="text-3xl">💳</div>
              <p className="mt-2 text-sm font-medium text-white">
                Payment integration coming soon
              </p>
              <p className="mt-1 text-xs text-slate-500">
                UPI · PayPal · Stripe · Crypto — choose your method here once
                wired up.
              </p>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center gap-2.5 text-slate-300">
                <span className="text-emerald-400">✓</span> Instant delivery
              </div>
              <div className="flex items-center gap-2.5 text-slate-300">
                <span className="text-emerald-400">✓</span> Replacement
                guarantee
              </div>
              <div className="flex items-center gap-2.5 text-slate-300">
                <span className="text-emerald-400">✓</span> 24/7 support
              </div>
            </div>
          </div>

          {/* "Buy Now" confirm button — PAYMENT STUB */}
          <div className="mt-8">
            <button
              onClick={handlePayClick}
              disabled={confirming}
              className="btn-primary w-full py-4 text-base"
            >
              Confirm &amp; Pay {formatPrice(product.price)}
            </button>

            <AnimatePresence>
              {paymentHint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="rounded-xl border border-brand-blue/30 bg-brand-blue/10 p-4 text-sm leading-relaxed text-slate-300">
                    💬 {paymentHint}
                    <a
                      href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand-cyan hover:underline"
                    >
                      <DiscordIcon className="h-4 w-4" /> Join the Discord
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mt-4 text-center text-xs text-slate-500">
              🔐 Checkout is protected — nothing is charged automatically.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
