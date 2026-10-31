"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "@/lib/format";
import { DiscordIcon } from "@/components/Navbar";

export default function CheckoutClient({
  initialOrder,
  qrCodeDataUrl,
  upiLink,
  upiIdMasked,
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [utrInput, setUtrInput] = useState(initialOrder?.utr || "");
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);

  // Expiration calculation based on server's expiresAt
  const expiresAtMs = useMemo(() => {
    return order?.expiresAt ? new Date(order.expiresAt).getTime() : 0;
  }, [order?.expiresAt]);

  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    if (!expiresAtMs || order?.status !== "pending") return 0;
    return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
  });

  // Total duration in seconds for progress bar (10 minutes = 600 seconds)
  const totalDurationSeconds = 600;

  // 1. Live Countdown Timer
  useEffect(() => {
    if (order?.status !== "pending" || !expiresAtMs) return;

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.floor((expiresAtMs - now) / 1000));
      setRemainingSeconds(left);

      if (left <= 0 && order.status === "pending") {
        setOrder((prev) => ({ ...prev, status: "expired" }));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAtMs, order?.status]);

  // 2. Poll Order Status every 5 seconds
  useEffect(() => {
    if (order?.status !== "pending") return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order._id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.order) {
          setOrder(data.order);
        }
      } catch (err) {
        // Polling failure is silent
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [order?._id, order?.status]);

  // Format mm:ss
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const progressPercent = Math.min(
    100,
    Math.max(0, (remainingSeconds / totalDurationSeconds) * 100)
  );

  const isCritical = remainingSeconds <= 60 && remainingSeconds > 0;
  const isExpired = order?.status === "expired" || remainingSeconds <= 0;
  const isPaid = order?.status === "paid" || order?.status === "completed";
  const isCancelled = order?.status === "cancelled";

  // Handle UTR Submission
  const handleSubmitUtr = async (e) => {
    e.preventDefault();
    const clean = utrInput.replace(/[\s-]/g, "");

    if (!/^\d{12}$/.test(clean)) {
      setToast({
        type: "error",
        message: "Please enter a valid 12-digit numeric UPI UTR / Transaction ID.",
      });
      return;
    }

    setSubmittingUtr(true);
    setToast(null);

    try {
      const res = await fetch(`/api/orders/${order._id}/utr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr: clean }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit UTR");
      }

      setOrder((prev) => ({ ...prev, utr: clean }));
      setToast({
        type: "success",
        message: "UTR submitted successfully! Waiting for admin payment verification.",
      });
    } catch (err) {
      setToast({
        type: "error",
        message: err.message || "Failed to submit UTR. Please try again.",
      });
    } finally {
      setSubmittingUtr(false);
    }
  };

  const copyOrderId = () => {
    navigator.clipboard.writeText(String(order._id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const discordInvite =
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/tvw2zFMyzA";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-10 sm:px-8">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-xs text-neutral-400">
        <Link href="/" className="hover:text-white transition">
          Home
        </Link>
        <span>/</span>
        <Link href="/products" className="hover:text-white transition">
          Products
        </Link>
        <span>/</span>
        <span className="text-white font-medium">Checkout</span>
      </nav>

      {/* ── Toast Alert ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mt-6 flex items-center justify-between rounded-xl border p-4 text-xs font-semibold ${
              toast.type === "success"
                ? "border-emerald-500/30 bg-[#06150b] text-emerald-300"
                : "border-red-500/30 bg-[#170505] text-red-300"
            }`}
          >
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-4 hover:text-white">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN CHECKOUT CONTAINER ── */}
      <div className="mt-8 space-y-8">
        {/* Top Header Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 backdrop-blur-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-neutral-300">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isPaid
                      ? "bg-emerald-400"
                      : isExpired
                      ? "bg-neutral-500"
                      : "bg-amber-400 animate-pulse"
                  }`}
                />
                Status: {order.status}
              </span>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                UPI Instant Checkout
              </h1>
              <p className="mt-1 text-xs text-neutral-400">
                Complete your payment within 10 minutes to verify your order automatically.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-neutral-400">Order ID:</span>
              <button
                onClick={copyOrderId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black px-2.5 py-1 font-mono text-xs text-white hover:border-white transition"
                title="Click to copy full Order ID"
              >
                <span>#{String(order._id).slice(-8)}</span>
                <span className="text-[10px] text-neutral-400">
                  {copied ? "✓ Copied" : "📋"}
                </span>
              </button>
            </div>
          </div>

          {/* ── LIVE COUNTDOWN TIMER & PROGRESS BAR (Only if pending) ── */}
          {order.status === "pending" && !isExpired && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-medium text-neutral-400">
                  <svg className="h-4 w-4 text-neutral-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Payment Timer Remaining
                </span>
                <span
                  className={`font-mono text-xl font-extrabold tracking-wider ${
                    isCritical ? "text-red-400 animate-pulse" : "text-white"
                  }`}
                >
                  {formatTimer(remainingSeconds)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-neutral-900 border border-white/5">
                <div
                  className={`h-full transition-all duration-1000 ${
                    isCritical
                      ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                      : "bg-white"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {isCritical && (
                <p className="mt-2 text-[11px] font-semibold text-red-400">
                  ⚠️ Less than 1 minute remaining! Complete payment before this order expires.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── PAID / COMPLETED STATE ── */}
        {isPaid && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-emerald-500/40 bg-[#06150b] p-8 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/20 text-3xl text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.3)]">
              ✓
            </div>
            <h2 className="mt-5 text-2xl font-black text-white">Payment Confirmed!</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-emerald-200/80">
              Your payment has been successfully recorded and verified. Your digital credentials and
              access are being delivered.
            </p>

            <div className="mx-auto mt-6 max-w-sm rounded-xl border border-emerald-500/20 bg-black/50 p-4 text-xs text-neutral-300 space-y-2">
              <div className="flex justify-between">
                <span className="text-neutral-400">Product:</span>
                <span className="font-semibold text-white">{order.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Amount Paid:</span>
                <span className="font-mono font-bold text-emerald-300">
                  {formatPrice(order.price)}
                </span>
              </div>
              {order.utr && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">UTR Reference:</span>
                  <span className="font-mono text-white">{order.utr}</span>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/dashboard?tab=orders" className="btn-primary !py-2.5 !text-xs font-bold">
                View in Dashboard
              </Link>
              <a
                href={discordInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost !py-2.5 !text-xs"
              >
                <DiscordIcon className="h-4 w-4" />
                Join Discord Desk
              </a>
            </div>
          </motion.div>
        )}

        {/* ── EXPIRED STATE ── */}
        {isExpired && !isPaid && !isCancelled && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-red-500/30 bg-[#140606] p-8 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-2xl text-red-400">
              ⏱
            </div>
            <h2 className="mt-4 text-xl font-bold text-white">Payment Window Expired</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-400">
              This order reached the 10-minute timeout limit and has been marked as expired on the
              server. The QR code has been deactivated to prevent unpaid or stale transactions.
            </p>
            <div className="mt-6">
              <Link href="/products" className="btn-primary !py-2.5 !text-xs font-bold">
                Create New Order
              </Link>
            </div>
          </motion.div>
        )}

        {/* ── CANCELLED STATE ── */}
        {isCancelled && (
          <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-8 text-center">
            <h2 className="text-xl font-bold text-white">Order Cancelled</h2>
            <p className="mt-2 text-xs text-neutral-400">
              This order was cancelled by the store administrator.
            </p>
            <Link href="/products" className="btn-primary mt-6 !text-xs">
              Return to Catalog
            </Link>
          </div>
        )}

        {/* ── ACTIVE PAYMENT SECTION (QR + SUMMARY + UTR FORM) ── */}
        {order.status === "pending" && !isExpired && (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left: Auto-Generated UPI QR Code Card */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white p-6 shadow-2xl text-black text-center">
                <span className="inline-block rounded-md bg-neutral-100 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                  Scan &amp; Pay via Any UPI App
                </span>

                {/* QR Code Graphic */}
                <div className="relative my-4 flex items-center justify-center">
                  {qrCodeDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrCodeDataUrl}
                      alt="UPI QR Code"
                      width={280}
                      height={280}
                      className="rounded-lg shadow-sm"
                    />
                  ) : (
                    <div className="h-64 w-64 animate-pulse rounded-lg bg-neutral-200" />
                  )}
                </div>

                {/* Amount & Order details underneath QR */}
                <div className="border-t border-neutral-200 pt-3">
                  <div className="font-mono text-3xl font-black text-black">
                    {formatPrice(order.price)}
                  </div>
                  <div className="mt-1 font-mono text-xs font-medium text-neutral-600">
                    Order Ref: #{String(order._id).slice(-8)}
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    Payee: <strong>{upiIdMasked}</strong>
                  </div>
                </div>

                {/* Supported Apps Logos */}
                <div className="mt-4 flex items-center justify-center gap-3 border-t border-neutral-100 pt-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  <span>GPay</span>
                  <span>•</span>
                  <span>PhonePe</span>
                  <span>•</span>
                  <span>Paytm</span>
                  <span>•</span>
                  <span>BHIM</span>
                  <span>•</span>
                  <span>Cred</span>
                </div>
              </div>

              {/* Mobile Direct Pay Button */}
              <div className="mt-4 w-full max-w-sm">
                <a
                  href={upiLink}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-xs font-bold shadow-lg"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                  Pay with UPI App (Mobile Only)
                </a>
                <p className="mt-2 text-center text-[10px] text-neutral-500">
                  Tap to launch Google Pay, PhonePe, or Paytm directly.
                </p>
              </div>
            </div>

            {/* Right: Order Summary & UTR Input Form */}
            <div className="lg:col-span-6 space-y-6">
              {/* Order Summary Card */}
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Order Summary
                </h3>

                <div className="mt-4 space-y-3 divide-y divide-white/5 text-xs">
                  <div className="flex justify-between pb-3">
                    <span className="text-neutral-400">Product:</span>
                    <span className="font-semibold text-white">{order.productName}</span>
                  </div>

                  {order.plan?.label && (
                    <div className="flex justify-between pt-3">
                      <span className="text-neutral-400">Duration Plan:</span>
                      <span className="inline-flex items-center gap-1.5 rounded border border-white/15 bg-white/5 px-2 py-0.5 font-medium text-white">
                        {order.plan.label}{" "}
                        {Number(order.plan.days) > 0
                          ? `(${order.plan.days} Days)`
                          : "(Lifetime)"}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between pt-3">
                    <span className="text-neutral-400">Quantity:</span>
                    <span className="font-mono text-white">{order.quantity || 1} unit</span>
                  </div>

                  <div className="flex justify-between pt-3">
                    <span className="text-neutral-400">Total Payable:</span>
                    <span className="font-mono text-xl font-black text-white">
                      {formatPrice(order.price)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── UTR / TRANSACTION ID SUBMISSION ── */}
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Submit Payment Reference
                  </h3>
                  <span className="text-[10px] text-neutral-400 font-mono">12 Digits</span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                  After paying in your UPI app, find the 12-digit <strong>UTR</strong> or{" "}
                  <strong>UPI Reference Number</strong> in your transaction receipt and enter it below.
                </p>

                {order.utr ? (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-amber-300">
                        Submitted UTR:
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        {order.utr}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-200">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      Waiting for admin verification. This page will update automatically.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitUtr} className="mt-4 space-y-3">
                    <div>
                      <input
                        type="text"
                        maxLength={16}
                        required
                        value={utrInput}
                        onChange={(e) => setUtrInput(e.target.value)}
                        placeholder="Enter 12-digit UPI UTR (e.g. 430123456789)"
                        className="w-full rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-xs text-white placeholder-neutral-500 outline-none focus:border-white transition"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingUtr || !utrInput.trim()}
                      className="btn-primary w-full !py-2.5 !text-xs font-bold"
                    >
                      {submittingUtr ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Submitting UTR...
                        </span>
                      ) : (
                        "Submit UTR for Instant Verification"
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* Discord Support Assistance */}
              <div className="rounded-xl border border-white/5 bg-black/40 p-4 text-xs text-neutral-400">
                <p className="font-medium text-neutral-300">Need instant human help?</p>
                <p className="mt-1 text-[11px] leading-relaxed">
                  Join our Discord server and share your Order ID (
                  <strong className="font-mono text-white">#{String(order._id).slice(-8)}</strong>
                  ) with support staff for direct delivery assistance.
                </p>
                <a
                  href={discordInvite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-white hover:underline"
                >
                  <DiscordIcon className="h-3.5 w-3.5" />
                  Join Discord Desk →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

