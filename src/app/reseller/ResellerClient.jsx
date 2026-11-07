"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "@/lib/format";
import {
  RESELLER_DISCOUNT_PERCENT,
  RESELLER_PRICE,
} from "@/lib/reseller";
import ResellerBadge from "@/components/ResellerBadge";

const BENEFITS = [
  {
    title: "50% OFF on License App products",
    desc: "Every auth-panel / license product is automatically half price at checkout.",
  },
  {
    title: "Works on future products",
    desc: "New License App products added later are included automatically — no re-joining.",
  },
  {
    title: "Lifetime membership",
    desc: "Pay once. The reseller status stays on your account permanently.",
  },
  {
    title: "Reseller profile badge",
    desc: "Your account and navbar show a verified Reseller badge across the store.",
  },
];

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-white"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function ResellerClient({
  loggedIn = false,
  initialIsReseller = false,
  resellerSince = null,
}) {
  const router = useRouter();
  const { update } = useSession();
  const idempotencyKeyRef = useRef("");
  const [isReseller, setIsReseller] = useState(initialIsReseller);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sessionSyncedRef = useRef(false);

  useEffect(() => {
    if (!isReseller || sessionSyncedRef.current) return;
    sessionSyncedRef.current = true;
    update?.();
  }, [isReseller, update]);

  const getKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `rs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    return idempotencyKeyRef.current;
  };

  const handleJoin = async () => {
    if (isReseller) return;

    if (!loggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/reseller")}`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/reseller/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": getKey(),
        },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          const statusRes = await fetch("/api/account/reseller", {
            cache: "no-store",
          });
          const statusData = await statusRes.json().catch(() => ({}));

          if (statusData?.isReseller) {
            setIsReseller(true);
            await update?.();
            return;
          }

          throw new Error(
            data.error || "Please wait a moment and try again."
          );
        }
        throw new Error(data.error || "Could not start the membership.");
      }

      idempotencyKeyRef.current = "";

      if (data.checkoutUrl) {
        await update?.();
        router.push(data.checkoutUrl);
        return;
      }

      throw new Error("Checkout link was not created. Please try again.");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sinceLabel = resellerSince
    ? new Date(resellerSince).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-12 sm:px-8">
      {/* Header */}
      <div className="text-center">
        <span className="badge-theme px-3 py-1 text-xs font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          Reseller Program
        </span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Become a Reseller
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Unlock a permanent{" "}
          <strong className="text-white">{RESELLER_DISCOUNT_PERCENT}% OFF</strong>{" "}
          on every License App product for a one-time{" "}
          <strong className="text-white">{formatPrice(RESELLER_PRICE)}</strong>{" "}
          membership.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        {/* Benefits */}
        <div className="glass p-6 sm:p-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
            What you unlock
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {BENEFITS.map((benefit, idx) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.06 }}
                className="flex items-start gap-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5">
                  <CheckIcon />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{benefit.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                    {benefit.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-white/10 bg-black/50 p-4 text-xs leading-relaxed text-neutral-400">
            <p className="font-semibold text-white">Good to know</p>
            <ul className="mt-2 space-y-1.5">
              <li>• The discount applies to License App (auth panel) products only.</li>
              <li>• Reseller and coupon discounts never stack — the bigger one wins.</li>
              <li>• Membership is activated instantly after your UPI payment is verified.</li>
              <li>• One membership per account, valid for a lifetime.</li>
            </ul>
          </div>
        </div>

        {/* Pricing card */}
        <div className="glass relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/5 blur-3xl" />

          {isReseller ? (
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white">
                  <CheckIcon />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">You are a Reseller</p>
                  <ResellerBadge className="mt-1" />
                </div>
              </div>

              <p className="mt-5 text-xs leading-relaxed text-neutral-400">
                Your lifetime membership is active{sinceLabel ? ` since ${sinceLabel}` : ""}.
                The {RESELLER_DISCOUNT_PERCENT}% discount is applied automatically to
                every License App product.
              </p>

              <Link
                href="/products"
                className="btn-primary mt-6 w-full py-3 text-sm font-bold"
              >
                Browse License Products
              </Link>
            </div>
          ) : (
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Lifetime Membership
                </span>
                <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  One-time
                </span>
              </div>

              <div className="mt-5 flex items-end gap-2">
                <span className="font-mono text-5xl font-black tracking-tight text-white">
                  {formatPrice(RESELLER_PRICE)}
                </span>
                <span className="pb-1 text-xs text-neutral-400">/ lifetime</span>
              </div>

              <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5">
                <span className="font-mono text-sm font-black text-white">
                  {RESELLER_DISCOUNT_PERCENT}% OFF
                </span>
                <span className="text-[11px] text-neutral-400">
                  on all License App products
                </span>
              </div>

              <ul className="mt-6 space-y-2.5 border-t border-white/10 pt-5">
                {[
                  "Instant activation after payment",
                  "Works on future license products",
                  "Permanent reseller badge",
                  "No renewal or hidden fees",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-xs text-neutral-300"
                  >
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={handleJoin}
                disabled={loading}
                className="btn-primary mt-6 w-full py-3.5 text-sm font-bold shadow-lg disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Starting Checkout...
                  </span>
                ) : loggedIn ? (
                  `Join Reseller · ${formatPrice(RESELLER_PRICE)}`
                ) : (
                  "Sign in to Join"
                )}
              </button>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-neutral-500">
                Payment is collected securely through the same UPI checkout used for
                product orders. Membership activates after verification.
              </p>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="relative mt-4 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
