"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "@/lib/format";
import { DiscordIcon } from "@/components/Navbar";

// ── SVG Brand Icons (generic/stylized glyphs, zero copyrighted files) ──

function PhonePeIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#5f259f" />
      <path
        d="M8.5 7h4a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-2v4h-2V7zm2 4.5h2a1.5 1.5 0 0 0 0-3h-2v3z"
        fill="#ffffff"
      />
    </svg>
  );
}

function GPayIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1f2937" />
      <path
        d="M17.5 12.2c0-.4-.03-.7-.1-.9h-5.4v1.8h3.1c-.1.7-.5 1.3-1.2 1.8v1.4h1.9c1.1-1 1.7-2.5 1.7-4.1z"
        fill="#4285F4"
      />
      <path
        d="M12 17.8c1.6 0 2.9-.5 3.9-1.4l-1.9-1.5c-.5.4-1.2.6-2 .6-1.5 0-2.8-1-3.2-2.4H6.8v1.5c1 2 3.1 3.2 5.2 3.2z"
        fill="#34A853"
      />
      <path
        d="M8.8 13.1c-.1-.4-.2-.8-.2-1.1s.1-.8.2-1.1V9.4H6.8c-.4.9-.7 1.8-.7 2.7s.2 1.9.7 2.7l2-1.7z"
        fill="#FBBC05"
      />
      <path
        d="M12 8.2c.9 0 1.6.3 2.2.9l1.6-1.6C14.8 6.6 13.5 6 12 6c-2.1 0-4.2 1.3-5.2 3.3l2 1.7c.4-1.5 1.7-2.8 3.2-2.8z"
        fill="#EA4335"
      />
    </svg>
  );
}

function PaytmIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#002e6e" />
      <path
        d="M7 8h3.5c1.4 0 2.5 1 2.5 2.3 0 1.4-1.1 2.4-2.5 2.4H8.8V16H7V8zm1.8 3.3h1.6c.5 0 .9-.4.9-.9s-.4-.9-.9-.9H8.8v1.8zm6-1.3l1.8 4.2 1.8-4.2h1.9l-2.8 6h-1.8l-2.8-6h1.9z"
        fill="#00b9f5"
      />
    </svg>
  );
}

function GenericUpiIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" fill="#059669" stroke="#10b981" />
      <path d="M7 14l5-5 5 5" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9v6" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WhatsAppIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function CheckoutClient({
  initialOrder,
  qrCodeDataUrl,
  upiLink,
  upiLinks,
  upiId,
  upiName,
  formattedAmount,
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [utrInput, setUtrInput] = useState(initialOrder?.utr || "");
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [toast, setToast] = useState(null);

  // Copy feedback states
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [savedQr, setSavedQr] = useState(false);

  // Mobile detection & collapsible QR
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showQrMobile, setShowQrMobile] = useState(false);
  const [showUtrGuide, setShowUtrGuide] = useState(false);

  // App launch feedback & double-tap guard
  const [launchingApp, setLaunchingApp] = useState(null);
  const [appOpenNotice, setAppOpenNotice] = useState(false);
  const appNoticeTimerRef = useRef(null);
  const redirectTimerRef = useRef(null);

  const displayUpiId = upiId || initialOrder?.fampayUpiId || "rishabh04@fam";
  const displayUpiName = upiName || "RISHABH JH10C PAY";
  const displayAmount =
    formattedAmount ||
    (order.amountPaise
      ? (order.amountPaise / 100).toFixed(2)
      : (Number(order.price) || 0).toFixed(2));

  // Expiration calculation: 15-minute countdown (consistent with stock reservation)
  const TOTAL_DURATION_SECONDS = 15 * 60; // 900 seconds
  const expiresAtMs = useMemo(() => {
    return order?.expiresAt ? new Date(order.expiresAt).getTime() : 0;
  }, [order?.expiresAt]);

  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    if (!expiresAtMs || order?.status !== "pending") return 0;
    return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
  });

  // Client-side mobile detection (also paired with Tailwind responsive classes)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isNarrowScreen = window.innerWidth < 1024;
    setIsMobileDevice(isMobileUa || isNarrowScreen);

    const handleResize = () => {
      setIsMobileDevice(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") || window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 1. Live Countdown Timer (15 Minutes)
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

  // 2. Poll Order Status every 3.5s (Slows down to 20s when page is hidden)
  useEffect(() => {
    if (order?.status !== "pending") return;

    let timeoutId = null;
    let isCancelled = false;

    const poll = async () => {
      if (isCancelled) return;
      try {
        const res = await fetch(`/api/orders/${order._id}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data?.order && !isCancelled) {
            const newStatus = data.order.status;
            setOrder(data.order);
            if (newStatus === "paid" || newStatus === "completed") {
              setToast({
                type: "success",
                message: "Payment verified successfully!",
              });
              return; // Stop polling on success
            }
          }
        }
      } catch (err) {
        // Silent polling catch
      }

      if (!isCancelled) {
        // Active tab: 3500ms; Background tab: 20000ms
        const delay = document.visibilityState === "hidden" ? 20000 : 3500;
        timeoutId = setTimeout(poll, delay);
      }
    };

    timeoutId = setTimeout(poll, 3500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isCancelled) {
        clearTimeout(timeoutId);
        poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [order?._id, order?.status]);

  // 3. Auto-redirect upon Payment Verification with celebration
  useEffect(() => {
    const isPaid = order?.status === "paid" || order?.status === "completed";
    if (isPaid) {
      redirectTimerRef.current = setTimeout(() => {
        router.push("/dashboard?tab=orders");
      }, 4000);
    }
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [order?.status, router]);

  // Format mm:ss
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const progressPercent = Math.min(
    100,
    Math.max(0, (remainingSeconds / TOTAL_DURATION_SECONDS) * 100)
  );

  const isCritical = remainingSeconds <= 60 && remainingSeconds > 0;
  const isExpired = order?.status === "expired" || remainingSeconds <= 0;
  const isPaid = order?.status === "paid" || order?.status === "completed";
  const isCancelled = order?.status === "cancelled";

  // Handle Instant UPI App Launch
  const handleLaunchApp = useCallback(
    (appName) => {
      if (launchingApp || isPaid || isExpired) return;

      setLaunchingApp(appName);
      setAppOpenNotice(false);
      if (appNoticeTimerRef.current) clearTimeout(appNoticeTimerRef.current);

      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      const isAndroid = /Android/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/i.test(ua);

      let targetUrl = upiLinks?.generic || upiLink;

      if (appName === "phonepe") {
        targetUrl = isAndroid
          ? upiLinks?.phonepe?.intent || upiLinks?.phonepe?.ios || targetUrl
          : upiLinks?.phonepe?.ios || targetUrl;
      } else if (appName === "gpay") {
        targetUrl = isAndroid
          ? upiLinks?.gpay?.intent || upiLinks?.gpay?.ios || targetUrl
          : upiLinks?.gpay?.ios || targetUrl;
      } else if (appName === "paytm") {
        targetUrl = isAndroid
          ? upiLinks?.paytm?.intent || upiLinks?.paytm?.ios || targetUrl
          : upiLinks?.paytm?.ios || targetUrl;
      } else {
        targetUrl = upiLinks?.generic || upiLink;
      }

      // Launch URI
      try {
        window.location.href = targetUrl;
      } catch (err) {
        console.error("App launch failed:", err);
      }

      // Check after 2 seconds if user is still on page
      appNoticeTimerRef.current = setTimeout(() => {
        setLaunchingApp(null);
        if (document.visibilityState === "visible") {
          setAppOpenNotice(true);
        }
      }, 2000);
    },
    [launchingApp, isPaid, isExpired, upiLinks, upiLink]
  );

  // Copy Actions
  const copyUpiId = () => {
    navigator.clipboard.writeText(displayUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const copyAmount = () => {
    navigator.clipboard.writeText(displayAmount);
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const copyOrderId = () => {
    navigator.clipboard.writeText(String(order._id));
    setCopiedOrderId(true);
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  // Save QR Code Image
  const handleSaveQr = () => {
    if (!qrCodeDataUrl) return;
    try {
      const a = document.createElement("a");
      a.href = qrCodeDataUrl;
      a.download = `upi-qr-${String(order._id).slice(-8)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSavedQr(true);
      setTimeout(() => setSavedQr(false), 2500);
    } catch (err) {
      console.error("Failed to save QR code:", err);
    }
  };

  // Handle Instant UPI UTR Verification
  const handleSubmitUtr = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const clean = String(utrInput || order?.utr || "").replace(/[\s-]/g, "");

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
      const res = await fetch(`/api/orders/${order._id}/verify-utr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr: clean }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Payment verification failed");
      }

      if (data?.order) {
        setOrder(data.order);
      } else {
        setOrder((prev) => ({ ...prev, utr: clean, status: "paid" }));
      }

      setToast({
        type: "success",
        message: data.message || "Payment verified successfully!",
      });
    } catch (err) {
      setToast({
        type: "error",
        message: err.message || "Payment verification failed. Please try again.",
      });
    } finally {
      setSubmittingUtr(false);
    }
  };

  const discordInvite =
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/tvw2zFMyzA";

  // WhatsApp prefilled support link
  const rawWhatsApp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "+1 (825) 924-7058";
  const cleanWhatsApp = rawWhatsApp.replace(/[^0-9]/g, "");
  const waMessage = `Hi! I need help with my payment for Order #${String(order._id).slice(-8)}. Product: ${order.productName || "Product"}. Amount: ₹${displayAmount}.`;
  const whatsAppUrl = `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="mx-auto max-w-4xl px-3.5 pb-28 pt-8 sm:px-6 lg:px-8">
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
            className={`mt-4 flex items-center justify-between rounded-xl border p-3.5 text-xs font-semibold shadow-xl backdrop-blur-md ${
              toast.type === "success"
                ? "border-emerald-500/40 bg-[#06150b]/95 text-emerald-300"
                : "border-red-500/40 bg-[#170505]/95 text-red-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  toast.type === "success"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {toast.type === "success" ? "✓" : "!"}
              </span>
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="ml-3 text-neutral-400 hover:text-white transition"
              aria-label="Dismiss toast"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress Indicator: Created -> Received -> Delivered ── */}
      <div className="mt-6 rounded-xl border border-white/10 bg-[#0a0a0a] p-3 sm:p-4">
        <div className="flex items-center justify-between text-[11px] sm:text-xs">
          {/* Step 1 */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] sm:text-xs font-bold text-black">
              ✓
            </span>
            <span className="font-semibold text-white">Order Created</span>
          </div>

          <div className="h-0.5 flex-1 mx-2 sm:mx-4 bg-white/10">
            <div
              className={`h-full transition-all duration-500 ${
                isPaid ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold ${
                isPaid
                  ? "bg-emerald-500 text-black"
                  : isExpired
                  ? "bg-neutral-800 text-neutral-400"
                  : "bg-amber-400/20 text-amber-300 ring-2 ring-amber-400 animate-pulse"
              }`}
            >
              {isPaid ? "✓" : "2"}
            </span>
            <span
              className={`font-semibold ${
                isPaid
                  ? "text-emerald-400"
                  : isExpired
                  ? "text-neutral-500"
                  : "text-amber-300"
              }`}
            >
              Payment Verification
            </span>
          </div>

          <div className="h-0.5 flex-1 mx-2 sm:mx-4 bg-white/10">
            <div
              className={`h-full transition-all duration-500 ${
                isPaid ? "bg-emerald-500" : "bg-neutral-800"
              }`}
            />
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold ${
                isPaid
                  ? "bg-emerald-500 text-black"
                  : "bg-neutral-900 border border-neutral-700 text-neutral-500"
              }`}
            >
              {isPaid ? "✓" : "3"}
            </span>
            <span
              className={`font-semibold ${
                isPaid ? "text-white" : "text-neutral-500"
              }`}
            >
              Delivery
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN CHECKOUT CONTAINER ── */}
      <div className="mt-6 space-y-6">
        {/* Top Header Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6 backdrop-blur-md">
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
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
                  {isPaid ? "Payment Verified" : isExpired ? "Expired" : "Waiting for payment..."}
                </span>

                {!isPaid && !isExpired && (
                  <span className="text-[10px] font-medium text-neutral-400">
                    Live auto-sync
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl md:text-3xl">
                UPI Instant Checkout
              </h1>
              <p className="mt-1 text-xs text-neutral-400">
                Tap your preferred UPI app on mobile or scan the QR code to complete payment.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="font-mono text-xs text-neutral-400">Order ID:</span>
              <button
                type="button"
                onClick={copyOrderId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black px-2.5 py-1 font-mono text-xs text-white hover:border-white transition"
                title="Click to copy full Order ID"
                aria-label="Copy Order ID"
              >
                <span>#{String(order._id).slice(-8)}</span>
                <span className="text-[10px] text-neutral-400">
                  {copiedOrderId ? "✓ Copied" : "📋"}
                </span>
              </button>
            </div>
          </div>

          {/* ── 15-MINUTE COUNTDOWN TIMER & PROGRESS BAR ── */}
          {order.status === "pending" && !isExpired && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-neutral-400">
                  <svg className="h-3.5 w-3.5 text-neutral-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Payment Timer Remaining
                </span>
                <span
                  className={`font-mono text-lg font-extrabold tracking-wider ${
                    isCritical ? "text-red-400 animate-pulse" : "text-white"
                  }`}
                >
                  {formatTimer(remainingSeconds)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-900 border border-white/5">
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
                <p className="mt-2 text-[11px] font-semibold text-red-400 animate-pulse">
                  ⚠️ Kam se kam 1 minute bacha hai! Complete payment before this order expires.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── PAID / COMPLETED CELEBRATION STATE ── */}
        {isPaid && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-emerald-500/40 bg-[#06150b] p-6 sm:p-8 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20 text-3xl text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.35)] animate-bounce">
              ✓
            </div>
            <h2 className="mt-4 text-2xl font-black text-white">Payment Confirmed!</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-emerald-200/90">
              Aapka payment verify ho gaya hai. Aapke credentials aur license key order dashboard mein available hain.
            </p>
            <p className="mt-2 text-[11px] font-medium text-emerald-300">
              Redirecting to your orders dashboard in 3 seconds...
            </p>

            <div className="mx-auto mt-6 max-w-sm rounded-xl border border-emerald-500/25 bg-black/60 p-4 text-xs text-neutral-300 space-y-2 text-left">
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

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <Link href="/dashboard?tab=orders" className="btn-primary !py-2.5 !text-xs font-bold">
                View in Dashboard Now →
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
            className="rounded-2xl border border-red-500/30 bg-[#140606] p-6 sm:p-8 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-2xl text-red-400">
              ⏱
            </div>
            <h2 className="mt-4 text-xl font-bold text-white">Order Expired</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-400">
              Is order ka 15-minute payment window expire ho gaya hai aur stock reservation release ho gaya hai.
              UPI QR code deactivate kar diya gaya hai. Kripya naya order banayein.
            </p>
            <div className="mt-6">
              <Link href="/products" className="btn-primary !py-2.5 !text-xs font-bold">
                Naya Order Banao (Create New Order)
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
            <Link href="/products" className="btn-primary mt-6 !text-xs font-bold">
              Return to Catalog
            </Link>
          </div>
        )}

        {/* ── ACTIVE PAYMENT SECTION (MOBILE BUTTONS + QR + UTR) ── */}
        {order.status === "pending" && !isExpired && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Column: Mobile UPI App Buttons + QR Code */}
            <div className="lg:col-span-7 flex flex-col space-y-5">
              {/* 1. UPI APP BUTTONS (Prominent on Mobile, hidden on desktop) */}
              <div className="block lg:hidden rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 sm:p-5 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                      Fast Pay with UPI App
                    </h2>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Directly open app &amp; complete payment of{" "}
                      <strong className="text-white font-mono">₹{displayAmount}</strong>
                    </p>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    Instant
                  </span>
                </div>

                {/* 2-Column Responsive Grid with large tap target (min 48px) */}
                <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                  {/* PhonePe */}
                  <button
                    type="button"
                    onClick={() => handleLaunchApp("phonepe")}
                    disabled={Boolean(launchingApp)}
                    aria-label="Pay with PhonePe"
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-[#5f259f]/20 hover:bg-[#5f259f]/30 active:scale-[0.98] px-3 py-2.5 text-xs font-bold text-white transition focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <PhonePeIcon className="h-5 w-5 shrink-0" />
                    <span>PhonePe</span>
                  </button>

                  {/* Google Pay */}
                  <button
                    type="button"
                    onClick={() => handleLaunchApp("gpay")}
                    disabled={Boolean(launchingApp)}
                    aria-label="Pay with Google Pay"
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-950/30 hover:bg-blue-900/40 active:scale-[0.98] px-3 py-2.5 text-xs font-bold text-white transition focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <GPayIcon className="h-5 w-5 shrink-0" />
                    <span>Google Pay</span>
                  </button>

                  {/* Paytm */}
                  <button
                    type="button"
                    onClick={() => handleLaunchApp("paytm")}
                    disabled={Boolean(launchingApp)}
                    aria-label="Pay with Paytm"
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-[#002e6e]/30 hover:bg-[#002e6e]/45 active:scale-[0.98] px-3 py-2.5 text-xs font-bold text-white transition focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <PaytmIcon className="h-5 w-5 shrink-0" />
                    <span>Paytm</span>
                  </button>

                  {/* Other UPI Apps (Generic URI scheme) */}
                  <button
                    type="button"
                    onClick={() => handleLaunchApp("generic")}
                    disabled={Boolean(launchingApp)}
                    aria-label="Pay with Other UPI Apps"
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/40 active:scale-[0.98] px-3 py-2.5 text-xs font-bold text-emerald-300 transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <GenericUpiIcon className="h-5 w-5 shrink-0" />
                    <span>Other UPI</span>
                  </button>
                </div>

                {/* Double-tap guard feedback */}
                {launchingApp && (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-neutral-900/80 p-2 text-[11px] text-amber-300">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Opening UPI app... Kripya wait karein.
                  </div>
                )}

                {/* Fallback notice if app doesn't open within 2s */}
                {appOpenNotice && (
                  <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/30 p-2.5 text-center text-[11px] text-amber-200">
                    <p>App nahi khuli? <strong>Other UPI Apps</strong> try karein ya neeche QR code scan karein.</p>
                    <button
                      type="button"
                      onClick={() => setShowQrMobile(true)}
                      className="mt-1.5 font-bold text-white underline hover:text-amber-100"
                    >
                      Show QR Code ↓
                    </button>
                  </div>
                )}
              </div>

              {/* 2. QR CODE SECTION (Collapsible on mobile, always visible on desktop) */}
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-6 shadow-xl">
                {/* Mobile Collapsible Header */}
                <div className="lg:hidden">
                  <button
                    type="button"
                    onClick={() => setShowQrMobile((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"
                    aria-expanded={showQrMobile}
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="h-4 w-4 text-neutral-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" />
                      </svg>
                      <div>
                        <span className="text-xs font-bold text-white">
                          {showQrMobile ? "Hide QR Code" : "Scan UPI QR Code"}
                        </span>
                        <p className="text-[10px] text-neutral-400">
                          {showQrMobile ? "Tap to close QR view" : "Tap to scan with camera or second device"}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-sm text-neutral-400">
                      {showQrMobile ? "▲" : "▼"}
                    </span>
                  </button>
                </div>

                {/* QR Section Body: shown always on desktop (lg:block), toggleable on mobile */}
                <div className={`${showQrMobile ? "mt-4 block" : "hidden"} lg:block`}>
                  <div className="flex flex-col items-center text-center">
                    {/* Amount & Order ID Above QR */}
                    <div className="mb-3.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                        Exact Payable Amount
                      </span>
                      <div className="font-mono text-3xl sm:text-4xl font-black text-white">
                        ₹{displayAmount}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-neutral-400">
                        Order Ref: #{String(order._id).slice(-8)}
                      </div>
                    </div>

                    {/* QR Code Container with Quiet Zone (Fixed Size: prevents CLS) */}
                    <div className="relative flex items-center justify-center rounded-2xl bg-white p-3.5 sm:p-4 shadow-2xl">
                      {qrCodeDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrCodeDataUrl}
                          alt={`UPI QR Code for ${displayAmount} INR`}
                          width={280}
                          height={280}
                          className="h-[220px] w-[220px] sm:h-[260px] sm:w-[260px] md:h-[280px] md:w-[280px] rounded-lg object-contain"
                          loading="eager"
                        />
                      ) : (
                        <div className="flex h-[220px] w-[220px] sm:h-[260px] sm:w-[260px] md:h-[280px] md:w-[280px] animate-pulse items-center justify-center rounded-lg bg-neutral-200">
                          <span className="text-xs font-medium text-neutral-500">
                            Loading QR code...
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Payee Details Below QR */}
                    <div className="mt-3 text-center">
                      <p className="text-xs font-semibold text-white">{displayUpiName}</p>
                      <p className="font-mono text-xs text-neutral-400">{displayUpiId}</p>
                    </div>

                    {/* QR Quick Action Buttons: Copy UPI ID, Copy Amount, Save QR */}
                    <div className="mt-4 flex w-full max-w-sm flex-wrap items-center justify-center gap-2">
                      {/* Copy UPI ID */}
                      <button
                        type="button"
                        onClick={copyUpiId}
                        aria-label="Copy UPI ID"
                        className="flex-1 min-w-[100px] rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-neutral-200 transition"
                      >
                        {copiedUpi ? "✓ Copied ID" : "Copy UPI ID"}
                      </button>

                      {/* Copy Amount */}
                      <button
                        type="button"
                        onClick={copyAmount}
                        aria-label="Copy exact amount"
                        className="flex-1 min-w-[100px] rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-neutral-200 transition"
                      >
                        {copiedAmount ? "✓ Copied ₹" : "Copy Amount"}
                      </button>

                      {/* Save QR Image */}
                      <button
                        type="button"
                        onClick={handleSaveQr}
                        aria-label="Download QR code image"
                        className="flex-1 min-w-[100px] rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-neutral-200 transition"
                      >
                        {savedQr ? "✓ Saved" : "Save QR"}
                      </button>
                    </div>

                    {/* Supported Apps List */}
                    <div className="mt-4 flex items-center justify-center gap-2.5 border-t border-white/5 pt-3 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                      <span>PhonePe</span>
                      <span>•</span>
                      <span>GPay</span>
                      <span>•</span>
                      <span>Paytm</span>
                      <span>•</span>
                      <span>BHIM</span>
                      <span>•</span>
                      <span>Cred</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Order Summary + UTR Submission Fallback + Support */}
            <div className="lg:col-span-5 space-y-5">
              {/* Order Summary Card */}
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6 shadow-xl">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Order Summary
                </h2>

                <div className="mt-3.5 space-y-2.5 divide-y divide-white/5 text-xs">
                  <div className="flex justify-between pb-2.5">
                    <span className="text-neutral-400">Product:</span>
                    <span className="font-semibold text-white truncate max-w-[200px]">
                      {order.productName}
                    </span>
                  </div>

                  {order.plan?.label && (
                    <div className="flex justify-between pt-2.5">
                      <span className="text-neutral-400">Duration Plan:</span>
                      <span className="inline-flex items-center rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white">
                        {order.plan.label}{" "}
                        {Number(order.plan.days) > 0
                          ? `(${order.plan.days} Days)`
                          : "(Lifetime)"}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between pt-2.5">
                    <span className="text-neutral-400">Quantity:</span>
                    <span className="font-mono text-white">{order.quantity || 1} unit</span>
                  </div>

                  {order.couponCode && (
                    <div className="flex justify-between pt-2.5 text-emerald-400">
                      <span>Coupon ({order.couponCode}):</span>
                      <span className="font-mono font-semibold">
                        -{formatPrice(order.couponDiscount || 0)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline pt-2.5">
                    <span className="text-neutral-300 font-medium">Total Payable:</span>
                    <span className="font-mono text-xl sm:text-2xl font-black text-white">
                      ₹{displayAmount}
                    </span>
                  </div>
                </div>
              </div>

              {/* UTR / Transaction Reference Submission */}
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                    Submit UTR Reference
                  </h2>
                  <span className="text-[10px] text-neutral-400 font-mono">12 Digits</span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                  UPI app se payment karne ke baad receipt mein 12-digit <strong>UTR</strong> ya{" "}
                  <strong>UPI Reference No</strong> yahan enter karein.
                </p>

                {/* Collapsible "UTR Kahan Milega" Guide */}
                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={() => setShowUtrGuide((prev) => !prev)}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <span>{showUtrGuide ? "▲ Hide guide" : "ℹ UTR kahan milega? (Tap to check)"}</span>
                  </button>

                  {showUtrGuide && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-2 space-y-1.5 rounded-lg border border-white/10 bg-black/60 p-3 text-[11px] text-neutral-300"
                    >
                      <p>
                        <strong className="text-white">Google Pay:</strong> Transaction detail kholo → &ldquo;UPI transaction ID&rdquo; (12 digits).
                      </p>
                      <p>
                        <strong className="text-white">PhonePe:</strong> Payment details kholo → &ldquo;UTR&rdquo; ya &ldquo;Debited from&rdquo; ke paas 12 digits.
                      </p>
                      <p>
                        <strong className="text-white">Paytm:</strong> Order detail kholo → &ldquo;UPI Ref No.&rdquo; (12 digits).
                      </p>
                    </motion.div>
                  )}
                </div>

                {order.utr && !utrInput ? (
                  <div className="mt-3.5 rounded-xl border border-white/10 bg-neutral-900/60 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-300">
                        Submitted UTR:
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        {order.utr}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-amber-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      Automatic verification in progress. Wait 30-60s or click verify again.
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleSubmitUtr}
                        disabled={submittingUtr}
                        className="btn-primary flex-1 !py-2 !text-xs font-bold"
                      >
                        {submittingUtr ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Verifying...
                          </span>
                        ) : (
                          "Verify Payment"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUtrInput(order.utr)}
                        className="btn-ghost !py-2 !text-xs"
                      >
                        Edit UTR
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitUtr} className="mt-3.5 space-y-3">
                    <div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={16}
                        required
                        value={utrInput}
                        onChange={(e) => setUtrInput(e.target.value)}
                        placeholder="Enter 12-digit UTR (e.g. 430123456789)"
                        className="w-full rounded-lg border border-white/15 bg-black px-3.5 py-2.5 font-mono text-xs text-white placeholder-neutral-500 outline-none focus:border-white transition"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingUtr || !utrInput.trim()}
                      className="btn-primary w-full !py-2.5 !text-xs font-bold disabled:opacity-50"
                    >
                      {submittingUtr ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Verifying Payment...
                        </span>
                      ) : (
                        "Verify Payment"
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* Support Contact Section: WhatsApp & Discord */}
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 sm:p-5 text-xs text-neutral-400 space-y-3">
                <div>
                  <h3 className="font-semibold text-white">Need help with your order?</h3>
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    Payment fas gaya ya koi sawal hai to turant support par connect karein:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* WhatsApp Support Button */}
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/40 p-2 text-xs font-semibold text-emerald-300 transition"
                  >
                    <WhatsAppIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>WhatsApp Support</span>
                  </a>

                  {/* Discord Support Button */}
                  <a
                    href={discordInvite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-950/30 hover:bg-indigo-900/40 p-2 text-xs font-semibold text-indigo-300 transition"
                  >
                    <DiscordIcon className="h-4 w-4 shrink-0 text-indigo-400" />
                    <span>Discord Desk</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
