"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductImage from "@/components/ProductImage";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "@/lib/format";
import { calculateDiscount } from "@/lib/offer-utils";
import {
  isLicenseProduct,
  resellerDiscountAmount,
} from "@/lib/reseller";
import {
  getPlanStockInfo,
  getStockBadge,
  pickDefaultPlan,
} from "@/lib/stock";
import { DiscordIcon } from "@/components/Navbar";
import useResellerStatus from "@/components/useResellerStatus";

export default function ProductDetailClient({ product, initialCouponCode = "" }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isReseller = useResellerStatus();

  const allImages =
    product.images && product.images.length > 0
      ? product.images
      : product.imageUrl
      ? [product.imageUrl]
      : [];

  const [activeImage, setActiveImage] = useState(allImages[0] || "");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Duration Pricing Plans (Nitro style)
  const hasPlans = Array.isArray(product.plans) && product.plans.length > 0;
  // Default to the cheapest plan that is currently purchasable.
  const defaultPlan = pickDefaultPlan(product);

  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);
  const currentPrice = selectedPlan ? Number(selectedPlan.price) : Number(product.price);
  const selectedStockInfo = getPlanStockInfo(product, selectedPlan);
  const stockBadge = getStockBadge(selectedStockInfo);

  const [couponInput, setCouponInput] = useState(initialCouponCode || "");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const couponDiscount = appliedCoupon ? calculateDiscount(currentPrice, appliedCoupon) : 0;
  const resellerEligible = isReseller && isLicenseProduct(product);
  const resellerDiscount = resellerEligible
    ? resellerDiscountAmount(currentPrice)
    : 0;
  const useResellerDiscount =
    resellerDiscount > 0 && resellerDiscount >= couponDiscount;
  const bestDiscount = Math.max(couponDiscount, resellerDiscount);
  const finalPrice = Math.max(
    0,
    Math.round((currentPrice - bestDiscount) * 100) / 100
  );

  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [cooldownChecked, setCooldownChecked] = useState(false);
  const [orderModal, setOrderModal] = useState(null);
  const checkoutIdempotencyKeyRef = useRef("");

  const getCheckoutIdempotencyKey = () => {
    if (!checkoutIdempotencyKeyRef.current) {
      checkoutIdempotencyKeyRef.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `ck_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    return checkoutIdempotencyKeyRef.current;
  };

  const isContent = product.deliveryType === "content";
  const isAvailable =
    product.active !== false &&
    product.available !== false &&
    selectedStockInfo.inStock;
  const isInMaintenance = Boolean(product?.inMaintenance);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/orders/cooldown")
        .then((r) => r.json())
        .then((data) => {
          if (data?.inCooldown && data.remainingSeconds > 0) {
            setCooldownRemaining(data.remainingSeconds);
          } else {
            setCooldownRemaining(0);
          }
          setCooldownChecked(true);
        })
        .catch(() => setCooldownChecked(true));
    } else {
      setCooldownChecked(true);
    }
  }, [status]);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const applyCoupon = async (rawCode) => {
    const code = String(rawCode ?? couponInput).trim();
    if (!code) {
      setCouponError("Please enter a coupon code.");
      return;
    }

    setCouponLoading(true);
    setCouponError("");

    try {
      const res = await fetch("/api/offers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          productId: product._id,
          ...(selectedPlan
            ? {
                planId: selectedPlan._id ? String(selectedPlan._id) : "",
                planLabel: selectedPlan.label,
                planDays: selectedPlan.days,
              }
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid coupon code.");

      setAppliedCoupon({
        code: data.code,
        title: data.title,
        discountLabel: data.discountLabel,
        discountType: data.discountType,
        discountValue: data.discountValue,
      });
      setCouponInput(data.code);
      setToast({
        type: "success",
        text: `Coupon ${data.code} applied — you save ${formatPrice(data.discount)}.`,
      });
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message || "Could not apply this coupon.");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  // Auto-apply the code passed by a "Claim Offer" link.
  useEffect(() => {
    if (initialCouponCode) applyCoupon(initialCouponCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePayment(order) {
    console.log("[Payment Integration Placeholder] Order created with pending status:", order);
    return { ok: true, pendingGateway: true };
  }

  const handleBuyNow = async () => {
    if (status !== "authenticated" || !session?.user) {
      const currentUrl = `/products/${product._id || product.slug}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`);
      return;
    }

    if (isInMaintenance) {
      setToast({
        type: "error",
        text:
          product.maintenanceReason ||
          "This product is currently under maintenance. Orders are temporarily paused.",
      });
      return;
    }

    if (!isAvailable) {
      setToast({ type: "error", text: "This product is currently out of stock or unavailable." });
      return;
    }

    if (!agreedToTerms) {
      setToast({
        type: "error",
        text: "Please tick the checkbox confirming you have read the product details before buying.",
      });
      return;
    }

    if (cooldownRemaining > 0) {
      setToast({
        type: "error",
        text: `Order cooldown active. Please wait ${formatCountdown(cooldownRemaining)} before ordering again.`,
      });
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      const payload = {
        productId: product._id,
        quantity: 1,
        ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
        ...(selectedPlan
          ? {
              planLabel: selectedPlan.label,
              planDays: selectedPlan.days,
              planPrice: selectedPlan.price,
            }
          : {}),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": getCheckoutIdempotencyKey(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.remainingSeconds) {
          setCooldownRemaining(data.remainingSeconds);
        }
        throw new Error(data.error || "Failed to create order");
      }

      // The order was created (or replayed); this checkout attempt is done.
      checkoutIdempotencyKeyRef.current = "";

      if (data.checkoutUrl || data.orderId) {
        router.push(data.checkoutUrl || `/checkout/${data.orderId}`);
        return;
      }

      await handlePayment(data.order);
      setOrderModal(
        data.order || {
          _id: data.orderId,
          price: currentPrice,
          productName: product.name,
          plan: selectedPlan,
        }
      );
      setCooldownRemaining(10 * 60);
      setLoading(false);
    } catch (err) {
      console.error("Order purchase failed:", err);
      setToast({ type: "error", text: err.message || "Something went wrong while placing order." });
      setLoading(false);
    }
  };

  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/tvw2zFMyzA";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-10 sm:px-8">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-xs text-neutral-400">
        <Link href="/" className="transition hover:text-white">
          Home
        </Link>
        <span className="text-neutral-600">/</span>
        <Link href="/products" className="transition hover:text-white">
          Products
        </Link>
        <span className="text-neutral-600">/</span>
        <span className="truncate text-white font-medium">{product.name}</span>
      </nav>

      {/* ── Toast Notification ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mt-6 flex items-center justify-between rounded-lg border p-4 text-xs font-medium ${
              toast.type === "success"
                ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                : "border-red-500/30 bg-red-950/40 text-red-300"
            }`}
          >
            <span>{toast.text}</span>
            <button onClick={() => setToast(null)} className="ml-4 hover:text-white">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Detail Layout (Two Columns) ── */}
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        {/* Left Column: Image Gallery */}
        <div className="space-y-4">
          <div className="glass relative aspect-video w-full overflow-hidden">
            <ProductImage
              src={activeImage}
              alt={product.name}
              width={1200}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              fallbackText={product.name}
              priority
            />

            <div className="absolute left-3 top-3">
              {isInMaintenance ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-black/85 px-2.5 py-0.5 text-xs font-bold text-amber-300 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Under Maintenance
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur-md border ${
                    !isAvailable
                      ? "border-neutral-700 bg-black/80 text-neutral-400"
                      : stockBadge.tone === "low"
                      ? "border-amber-500/40 bg-black/80 text-amber-300"
                      : "border-emerald-500/30 bg-black/80 text-emerald-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      !isAvailable
                        ? "bg-neutral-500"
                        : stockBadge.tone === "low"
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`}
                  />
                  {isAvailable ? stockBadge.label : "Out of Stock"}
                </span>
              )}
            </div>
          </div>

          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(img)}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border transition ${
                    activeImage === img
                      ? "border-white shadow-md scale-105"
                      : "border-theme-border opacity-60 hover:opacity-100"
                  }`}
                >
                  <ProductImage
                    src={img}
                    alt={`${product.name} image ${i + 1}`}
                    width={200}
                    sizes="96px"
                    className="object-cover"
                    fallbackText={product.name}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Title, Category, Price, Description, Buy CTA */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {product.category && (
              <span className="badge-theme px-2.5 py-0.5 text-xs font-medium">
                {product.category}
              </span>
            )}
            <span className="font-mono text-xs text-neutral-400">
              ID: {String(product._id || "").slice(-8)}
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {product.name}
          </h1>

          {/* Maintenance Alert Card */}
          {isInMaintenance && (
            <div className="mt-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-neutral-900/80 to-amber-950/30 p-4 shadow-lg backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      Under Maintenance
                    </span>
                    {product.maintenanceSource === "category" && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-neutral-300">
                        Category: {product.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-200">
                    {product.maintenanceReason ||
                      "This product is temporarily undergoing maintenance."}
                  </p>
                  {product.maintenanceUntil && (
                    <p className="mt-1 font-mono text-[11px] text-amber-300">
                      Estimated completion: {product.maintenanceUntil}
                    </p>
                  )}
                  <p className="mt-1.5 text-[10px] text-neutral-400">
                    Purchases are temporarily paused. If you already purchased, all existing orders and payment verifications remain fully active.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Huge Price */}
          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span
              className="font-mono text-4xl font-extrabold tracking-tight sm:text-5xl"
              style={{ color: "var(--accent-primary)" }}
            >
              {formatPrice(finalPrice)}
            </span>
            {bestDiscount > 0 && (
              <span className="font-mono text-lg text-neutral-500 line-through">
                {formatPrice(currentPrice)}
              </span>
            )}
            <span className="text-xs text-neutral-400">
              {selectedPlan
                ? selectedPlan.days === 0
                  ? isContent
                    ? "Lifetime access"
                    : "Lifetime license"
                  : isContent
                  ? `${selectedPlan.days}-day access`
                  : `${selectedPlan.days}-day license`
                : "One-time payment"}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            {isContent
              ? "Delivery details and link are shown after payment is verified."
              : "License key is delivered automatically after payment is verified."}
          </p>
          {useResellerDiscount && (
            <p className="mt-1 text-[11px] font-semibold text-emerald-400">
              Reseller 50% OFF applied — you save {formatPrice(resellerDiscount)}
            </p>
          )}
          {couponDiscount > 0 && !useResellerDiscount && (
            <p className="mt-1 text-[11px] font-semibold text-emerald-400">
              Coupon {appliedCoupon.code} applied — you save {formatPrice(couponDiscount)}
            </p>
          )}
          {couponDiscount > 0 && useResellerDiscount && (
            <p className="mt-1 text-[11px] text-neutral-400">
              Reseller price is better than coupon {appliedCoupon.code} — the
              reseller discount is applied.
            </p>
          )}
          {selectedStockInfo.inStock &&
            selectedStockInfo.limited &&
            selectedStockInfo.stock !== null &&
            selectedStockInfo.stock <= 5 && (
              <p className="mt-1 text-[11px] font-semibold text-amber-400">
                Only {selectedStockInfo.stock} left for this plan. Order soon.
              </p>
            )}

          {/* Nitro-Style Selectable Duration Plans */}
          {hasPlans && (
            <div className="mt-6 rounded-2xl border border-theme-border bg-theme-surface/60 p-4">
              <div className="flex items-center justify-between pb-3 border-b border-theme-border/40">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Select Duration Plan
                </span>
                <span className="text-[11px] font-medium text-neutral-500">
                  {product.plans.length} option{product.plans.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {product.plans.map((plan, idx) => {
                  const isSelected =
                    selectedPlan?.label === plan.label &&
                    Number(selectedPlan?.days) === Number(plan.days);
                  const isLifetime =
                    Number(plan.days) === 0 ||
                    String(plan.label).toLowerCase().includes("lifetime");
                  const planStock = getPlanStockInfo(product, plan);
                  const planBadge = getStockBadge(planStock);
                  const planDisabled = !planStock.inStock || isInMaintenance;
                  const planResellerDiscount =
                    isReseller && isLicenseProduct(product)
                      ? resellerDiscountAmount(plan.price)
                      : 0;
                  const planDisplayPrice = Math.max(
                    0,
                    Math.round(
                      (Number(plan.price) - planResellerDiscount) * 100
                    ) / 100
                  );

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={planDisabled}
                      onClick={() => {
                        if (!planDisabled) setSelectedPlan(plan);
                      }}
                      className={`relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                        planDisabled
                          ? "cursor-not-allowed border-neutral-800 bg-black/20 opacity-60"
                          : isSelected
                          ? "border-white bg-white/10 shadow-lg ring-1 ring-white/30"
                          : "border-theme-border bg-black/40 hover:border-theme-border-hover hover:bg-white/5"
                      }`}
                    >
                      {/* Lifetime Best Value Badge */}
                      {isLifetime && (
                        <span className="absolute -top-2.5 right-2 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500 to-yellow-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow-md">
                          ★ Best Value
                        </span>
                      )}

                      <div className="pr-4">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-white">
                            {plan.label || (plan.days === 0 ? "Lifetime" : `${plan.days} Days`)}
                          </span>
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                              isSelected
                                ? "border-white bg-white font-bold text-black"
                                : "border-neutral-700 bg-transparent text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-neutral-400">
                          {plan.days === 0
                            ? "Unlimited duration access"
                            : `${plan.days} Days validity`}
                        </p>
                        {planStock.limited && (
                          <p
                            className={`mt-1 text-[10px] font-semibold ${
                              planDisabled
                                ? "text-red-400"
                                : planBadge.tone === "low"
                                ? "text-amber-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {planBadge.label}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 border-t border-white/5 pt-2">
                        <span className="font-mono text-base font-extrabold text-white">
                          {formatPrice(planDisplayPrice)}
                        </span>
                        {planResellerDiscount > 0 && (
                          <span className="ml-2 font-mono text-[11px] text-neutral-500 line-through">
                            {formatPrice(plan.price)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Coupon Code */}
          <div className="mt-6 rounded-2xl border border-theme-border bg-theme-surface/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Have a coupon code?
              </span>
              {appliedCoupon && (
                <span className="text-[11px] font-semibold text-emerald-400">✓ Applied</span>
              )}
            </div>

            {appliedCoupon ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3">
                <div>
                  <p className="font-mono text-sm font-bold text-emerald-300">
                    {appliedCoupon.code}
                  </p>
                  <p className="mt-0.5 text-[11px] text-emerald-200/80">
                    You save {formatPrice(couponDiscount)}
                    {appliedCoupon.discountLabel ? ` · ${appliedCoupon.discountLabel}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="rounded border border-white/15 px-2.5 py-1 text-[11px] font-medium text-neutral-300 transition hover:bg-white/10 hover:text-white"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  applyCoupon();
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setCouponError("");
                  }}
                  placeholder="Enter coupon code"
                  className="w-full rounded-lg border border-theme-border bg-black/60 px-3 py-2 font-mono text-xs uppercase text-white placeholder-neutral-500 outline-none transition focus:border-theme-border-hover"
                />
                <button
                  type="submit"
                  disabled={couponLoading || !couponInput.trim()}
                  className="btn-primary shrink-0 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {couponLoading ? "Checking..." : "Apply Code"}
                </button>
              </form>
            )}

            {couponError && <p className="mt-2 text-[11px] text-red-400">{couponError}</p>}
          </div>

          <p className="mt-5 text-sm leading-relaxed text-neutral-300">
            {product.description ||
              "High performance digital product verified and tested for immediate automated deployment."}
          </p>

          {/* Features Checklist */}
          {product.features && product.features.length > 0 && (
            <div className="glass mt-6 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Product Features & Highlights
              </h3>
              <ul className="mt-3.5 space-y-2.5">
                {product.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-200">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: "var(--accent-primary)" }}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cooldown Warning Notice if active */}
          {cooldownRemaining > 0 && (
            <div className="mt-6 flex items-center gap-3 rounded-lg border border-neutral-800 bg-[#0d0d0d] p-3 text-xs text-neutral-300">
              <svg className="h-4 w-4 shrink-0 text-neutral-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>
                Anti-spam cooldown active: You can place another order in{" "}
                <strong className="font-mono text-white">{formatCountdown(cooldownRemaining)}</strong>
              </span>
            </div>
          )}

          {/* Mandatory confirmation before buying */}
          <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-theme-border bg-theme-surface/40 p-3">
            <input
              type="checkbox"
              id="agree-terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-700 bg-neutral-900 text-white focus:ring-0"
            />
            <label
              htmlFor="agree-terms"
              className="text-[11px] leading-relaxed text-neutral-300"
            >
              I have read the product details and agree to the{" "}
              <Link href="/terms" className="font-medium text-white underline">
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link href="/refund" className="font-medium text-white underline">
                Refund Policy
              </Link>
              . I understand digital products cannot be refunded once delivered.
            </label>
          </div>

          {/* Buy Now CTA */}
          <div className="mt-4 flex flex-col gap-3">
            <button
              onClick={handleBuyNow}
              disabled={loading || isInMaintenance || !isAvailable || cooldownRemaining > 0 || !agreedToTerms}
              className={`btn-primary w-full py-3.5 text-sm font-bold shadow-lg ${
                isInMaintenance || cooldownRemaining > 0 || !agreedToTerms ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing Order...
                </span>
              ) : isInMaintenance ? (
                "Under Maintenance"
              ) : cooldownRemaining > 0 ? (
                `Cooldown (${formatCountdown(cooldownRemaining)})`
              ) : !isAvailable ? (
                "Out of Stock"
              ) : status === "authenticated" ? (
                `Buy Now · ${formatPrice(finalPrice)}${selectedPlan?.label ? ` (${selectedPlan.label})` : ""}`
              ) : (
                "Sign In with Discord to Buy"
              )}
            </button>

            {isInMaintenance ? (
              <p className="text-center text-[11px] text-amber-400/90">
                Purchases are paused while maintenance is underway.
              </p>
            ) : !agreedToTerms && isAvailable && cooldownRemaining <= 0 ? (
              <p className="text-center text-[11px] text-amber-400/90">
                Tick the checkbox above to enable Buy Now.
              </p>
            ) : null}

            {status !== "authenticated" && !isInMaintenance && (
              <p className="text-center text-[11px] text-neutral-500">
                You will be redirected to Discord OAuth to securely confirm your identity.
              </p>
            )}
          </div>

          {/* Trust Badges */}
          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-theme-border pt-6 text-center">
            <div className="glass p-3">
              <svg
                className="mx-auto h-4 w-4"
                style={{ color: "var(--accent-primary)" }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="mt-1 text-[11px] font-semibold text-white">Instant Delivery</p>
              <p className="text-[10px] text-neutral-400">
                {isContent ? "Details after payment" : "Automated key delivery"}
              </p>
            </div>
            <div className="glass p-3">
              <svg
                className="mx-auto h-4 w-4"
                style={{ color: "var(--accent-primary)" }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="mt-1 text-[11px] font-semibold text-white">Discord Support</p>
              <p className="text-[10px] text-neutral-400">24/7 dedicated desk</p>
            </div>
            <div className="glass p-3">
              <svg
                className="mx-auto h-4 w-4"
                style={{ color: "var(--accent-primary)" }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-1 text-[11px] font-semibold text-white">Money Back</p>
              <p className="text-[10px] text-neutral-400">Guaranteed working</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order Confirmation Modal ── */}
      <AnimatePresence>
        {orderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="glass w-full max-w-lg p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-theme-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                    ✓
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Order Created Successfully</h3>
                    <p className="text-[11px] text-neutral-400">Status: Pending Fulfillment</p>
                  </div>
                </div>
                <button
                  onClick={() => setOrderModal(null)}
                  className="text-neutral-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-3 rounded-lg border border-theme-border bg-black/60 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Order ID:</span>
                  <span className="font-mono text-white">{String(orderModal._id)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Product:</span>
                  <span className="font-semibold text-white">{orderModal.productName || product.name}</span>
                </div>
                {orderModal.plan?.label && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Plan Duration:</span>
                    <span className="font-semibold text-white">
                      {orderModal.plan.label} {Number(orderModal.plan.days) > 0 ? `(${orderModal.plan.days} Days)` : "(Lifetime)"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-400">Total Price:</span>
                  <span className="font-mono font-bold text-white">{formatPrice(orderModal.price || currentPrice)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Payment Status:</span>
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Pending
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-theme-border bg-theme-raised p-4 text-xs text-neutral-300">
                <p className="font-semibold text-white">Next Steps:</p>
                <p className="mt-1 leading-relaxed text-neutral-400">
                  Your order is registered in our database. Join our Discord support server with your
                  Order ID to complete payment and receive your digital credentials immediately.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <a
                  href={discordInvite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex-1 py-2.5 text-xs font-semibold"
                >
                  <DiscordIcon className="h-4 w-4" />
                  Complete on Discord
                </a>
                <Link
                  href="/dashboard?tab=orders"
                  className="btn-ghost flex-1 py-2.5 text-xs text-center"
                >
                  View in Dashboard
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
