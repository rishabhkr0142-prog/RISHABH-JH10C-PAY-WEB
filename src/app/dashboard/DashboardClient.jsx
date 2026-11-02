"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice, timeAgo } from "@/lib/format";
import CountUp from "@/components/CountUp";
import { DiscordIcon } from "@/components/Navbar";
import WhatsAppSupport from "@/components/WhatsAppSupport";

const LINK_ERROR_MESSAGES = {
  discord_already_linked: "Discord is already linked to this account.",
  discord_used_by_another_account:
    "That Discord account is already linked to another store account.",
  discord_not_configured: "Discord linking is not configured yet.",
  discord_link_failed: "Discord linking failed. Please try again.",
  google_already_linked: "Google is already linked to this account.",
  google_used_by_another_account:
    "That Google account is already linked to another store account.",
  google_not_configured: "Google login is not configured yet.",
  google_link_failed: "Google linking failed. Please try again.",
  email_used_by_another_account:
    "That email already belongs to another store account.",
};

export default function DashboardClient({
  session,
  dbUser,
  orders = [],
  stats = { totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalSpent: 0 },
  initialTab = "overview",
  linked = "",
  linkError = "",
}) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") || initialTab || "overview";
  const [activeTab, setActiveTab] = useState(tabParam);

  // Orders tab search and filter
  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedId, setCopiedId] = useState(null);

  // License delivery actions
  const [licenseBusyId, setLicenseBusyId] = useState(null);
  const [resendBusyId, setResendBusyId] = useState(null);
  const [licenseNotice, setLicenseNotice] = useState(null);
  const [accountNotice, setAccountNotice] = useState(null);
  const [showOnHomepage, setShowOnHomepage] = useState(
    dbUser?.showOnHomepage !== false
  );
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");

  // Selected Order for Details Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Cooldown status
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (tabParam && ["overview", "orders", "history", "profile"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (dbUser?.showOnHomepage !== undefined) {
      setShowOnHomepage(dbUser.showOnHomepage !== false);
    }
  }, [dbUser?.showOnHomepage]);

  useEffect(() => {
    if (!linked && !linkError) return;

    if (linked) {
      setAccountNotice({
        type: "success",
        text:
          linked === "google"
            ? "Google account linked successfully."
            : "Discord account linked successfully.",
      });
      updateSession?.();
    } else {
      setAccountNotice({
        type: "error",
        text: LINK_ERROR_MESSAGES[linkError] || "Account linking failed. Please try again.",
      });
    }

    router.replace("/dashboard?tab=profile", { scroll: false });
  }, [linked, linkError, updateSession, router]);

  useEffect(() => {
    fetch("/api/orders/cooldown")
      .then((r) => r.json())
      .then((data) => {
        if (data?.inCooldown && data.remainingSeconds > 0) {
          setCooldownSeconds(data.remainingSeconds);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    router.push(`/dashboard?tab=${tab}`, { scroll: false });
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const showLicenseNotice = (type, text) => {
    setLicenseNotice({ type, text });
    setTimeout(() => setLicenseNotice(null), 5000);
  };

  const handleHomepageVisibilityToggle = async () => {
    if (visibilityBusy) return;

    const nextValue = !showOnHomepage;
    setShowOnHomepage(nextValue);
    setVisibilityBusy(true);
    setVisibilityError("");

    try {
      const res = await fetch("/api/account/homepage-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showOnHomepage: nextValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not update homepage photo setting");
      }
      setShowOnHomepage(data.showOnHomepage !== false);
      router.refresh();
    } catch (err) {
      setShowOnHomepage(!nextValue);
      setVisibilityError(err.message || "Could not update homepage photo setting");
    } finally {
      setVisibilityBusy(false);
    }
  };

  const planExpiryLabel = (order) => {
    const days = Number(order?.plan?.days) || 0;
    if (!days) return "Lifetime (no expiry)";
    const base = order?.deliveredAt || order?.paidAt;
    const date = base ? new Date(base) : null;
    if (!date || isNaN(date.getTime())) return `${days} days from delivery`;
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleRetryLicense = async (order) => {
    setLicenseBusyId(order._id);
    try {
      const res = await fetch(`/api/orders/${order._id}/retry-license`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not complete delivery");
      showLicenseNotice("success", "Delivery details are ready.");
      router.refresh();
    } catch (err) {
      showLicenseNotice("error", err.message);
    } finally {
      setLicenseBusyId(null);
    }
  };

  const handleResendDM = async (order) => {
    setResendBusyId(order._id);
    try {
      const res = await fetch(`/api/orders/${order._id}/resend-dm`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not resend the DM");
      showLicenseNotice("success", "Delivery details sent to your Discord DM.");
      router.refresh();
    } catch (err) {
      showLicenseNotice("error", err.message);
    } finally {
      setResendBusyId(null);
    }
  };

  const licenseOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.licenseKey ||
          ["completed", "paid", "processing"].includes(o.status)
      ),
    [orders]
  );

  const maskEmail = (email) => {
    if (!email) return "Not provided";
    const parts = email.split("@");
    if (parts.length !== 2) return email;
    const name = parts[0];
    const masked = name.length > 2 ? `${name[0]}***${name.slice(-1)}` : `${name[0]}***`;
    return `${masked}@${parts[1]}`;
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = statusFilter === "all" || o.status === statusFilter;
      if (!matchStatus) return false;

      if (!orderSearch.trim()) return true;
      const q = orderSearch.toLowerCase();
      const idMatch = String(o._id).toLowerCase().includes(q);
      const nameMatch = (o.productName || o.product?.name || "").toLowerCase().includes(q);

      return idMatch || nameMatch;
    });
  }, [orders, orderSearch, statusFilter]);

  const user = session?.user || {};
  const userAvatar = user.image || dbUser?.avatar;
  const userName = user.name || dbUser?.username || "Member";
  const userRole = session?.user?.isAdmin ? "Admin" : dbUser?.role === "client" ? "Client" : "User";
  const isRealDiscord = (value) => /^\d{15,25}$/.test(String(value || "").trim());
  const linkedDiscordId =
    dbUser?.authProviders?.discord?.id ||
    (isRealDiscord(dbUser?.discordId) ? dbUser.discordId : "") ||
    (isRealDiscord(user.discordId) ? user.discordId : "");
  const googleSub = dbUser?.authProviders?.google?.sub || user.googleSub || "";
  const googleEmail = dbUser?.authProviders?.google?.email || "";
  const isDiscordLinked = Boolean(linkedDiscordId);
  const isGoogleLinked = Boolean(googleSub);
  const accountId = dbUser?._id || user.id || "N/A";
  const headerAccountId = linkedDiscordId || accountId;
  const discordId = linkedDiscordId || "Not linked";
  const accountSources = [
    isDiscordLinked ? "Discord" : null,
    isGoogleLinked ? "Google" : null,
  ]
    .filter(Boolean)
    .join(" + ") || "Store account";
  const memberSince = dbUser?.createdAt
    ? new Date(dbUser.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recently";

  const historyEvents = useMemo(() => {
    const events = [];

    if (dbUser?.createdAt) {
      events.push({
        type: "account_created",
        title: "Account Created",
        desc: `Registered in store system via ${accountSources}.`,
        date: new Date(dbUser.createdAt),
      });
    }

    orders.forEach((o) => {
      events.push({
        type: "order_placed",
        title: `Order Placed: ${o.productName || "Product"}`,
        desc: `Order #${String(o._id).slice(-8)} placed for ${formatPrice(o.price || o.amount)}.`,
        date: new Date(o.createdAt),
        order: o,
      });

      if (o.status === "completed" || o.status === "paid") {
        events.push({
          type: "order_completed",
          title: `Fulfillment Completed: ${o.productName || "Product"}`,
          desc: `Order #${String(o._id).slice(-8)} delivered and marked as ${o.status}.`,
          date: new Date(o.updatedAt || o.createdAt),
          order: o,
        });
      }
    });

    return events.sort((a, b) => b.date - a.date);
  }, [orders, dbUser]);

  const renderStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending
          </span>
        );
      case "completed":
        return (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: "var(--accent-primary)", color: "var(--btn-primary-text)" }}
          >
            Completed
          </span>
        );
      case "paid":
        return (
          <span className="badge-theme px-2.5 py-0.5 text-[10px] font-semibold">
            Paid
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            Processing
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-800 px-2.5 py-0.5 text-[10px] font-medium text-neutral-400">
            Expired
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-[10px] font-medium text-neutral-500">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full border border-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400">
            {status}
          </span>
        );
    }
  };

  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/tvw2zFMyzA";

  const whatsappMessageFor = (order) =>
    [
      "Hello, mujhe support chahiye.",
      `Name: ${userName}`,
      order ? `Order ID: #${String(order._id)}` : "",
      order?.productName ? `Product: ${order.productName}` : "",
      order?.plan?.label ? `Plan: ${order.plan.label}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-10 sm:px-8">
      {/* ── Welcome Header Bar ── */}
      <div className="flex flex-col gap-5 border-b border-theme-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-theme-border bg-theme-surface">
            {userAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userAvatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-mono text-xl font-bold text-white">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {userName}
              </h1>
              <span className="badge-theme px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {userRole}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
              <span className="font-mono">ID: {headerAccountId}</span>
              <button
                onClick={() => copyToClipboard(headerAccountId, "user-id")}
                className="text-[11px] text-neutral-400 hover:text-white"
                title={linkedDiscordId ? "Copy Discord ID" : "Copy account ID"}
              >
                {copiedId === "user-id" ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Link href="/products" className="btn-primary !text-xs font-semibold">
            Browse Products
          </Link>
          <a
            href={discordInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost !text-xs"
          >
            <DiscordIcon className="h-3.5 w-3.5" />
            Discord Desk
          </a>
          <WhatsAppSupport
            message={whatsappMessageFor(null)}
            label="WhatsApp"
            className="!px-3 !py-2 !text-xs"
          />
        </div>
      </div>

      {/* ── Top Tabs ── */}
      <div className="mt-6 flex gap-1.5 overflow-x-auto border-b border-theme-border pb-3">
        {[
          { id: "overview", label: "Overview" },
          { id: "orders", label: `My Orders (${orders.length})` },
          { id: "history", label: "History" },
          { id: "profile", label: "Profile" },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                active
                  ? "btn-primary !px-4 !py-2 !text-xs font-bold shadow-sm"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === "overview" && (
        <div className="mt-8 space-y-8">
          {/* 4 Metric Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Total Orders
              </span>
              <p className="mt-2 font-mono text-3xl font-extrabold text-white">
                <CountUp value={stats.totalOrders} />
              </p>
              <span className="mt-1 block text-[11px] text-neutral-500">Lifetime purchases</span>
            </div>

            <div className="glass p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Pending Orders
              </span>
              <p className="mt-2 font-mono text-3xl font-extrabold text-white">
                <CountUp value={stats.pendingOrders} />
              </p>
              <span className="mt-1 block text-[11px] text-neutral-500">Awaiting fulfillment</span>
            </div>

            <div className="glass p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Completed
              </span>
              <p className="mt-2 font-mono text-3xl font-extrabold text-white">
                <CountUp value={stats.completedOrders} />
              </p>
              <span className="mt-1 block text-[11px] text-neutral-500">Fulfillment confirmed</span>
            </div>

            <div className="glass p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Total Spent
              </span>
              <p
                className="mt-2 font-mono text-3xl font-extrabold"
                style={{ color: "var(--accent-primary)" }}
              >
                {formatPrice(stats.totalSpent)}
              </p>
              <span className="mt-1 block text-[11px] text-neutral-500">Delivered volume</span>
            </div>
          </div>

          {/* Cooldown Timer Card */}
          <div className="glass p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Order Cooldown Guard
                </span>
                <p className="mt-1 text-sm font-bold text-white">
                  {cooldownSeconds > 0 ? "Anti-spam cooldown in progress" : "Queue status ready"}
                </p>
                <p className="text-xs text-neutral-400">
                  {cooldownSeconds > 0
                    ? `Next order available in ${formatCountdown(cooldownSeconds)}. Standard cooldown is 10 minutes.`
                    : "You are currently eligible to place orders with instant fulfillment."}
                </p>
              </div>

              <div>
                {cooldownSeconds > 0 ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-theme-border bg-black/60 px-4 py-2 font-mono text-sm font-bold text-white">
                    <span
                      className="h-2 w-2 rounded-full animate-pulse"
                      style={{ backgroundColor: "var(--accent-primary)" }}
                    />
                    {formatCountdown(cooldownSeconds)}
                  </div>
                ) : (
                  <Link href="/products" className="btn-primary !py-2 !text-xs">
                    Place New Order
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Recent Orders Section */}
          <div className="glass p-6">
            <div className="flex items-center justify-between border-b border-theme-border/50 pb-4">
              <div>
                <h2 className="text-base font-bold text-white">Recent Orders</h2>
                <p className="text-xs text-neutral-400">Your latest purchases and transactions</p>
              </div>
              <button
                onClick={() => switchTab("orders")}
                className="text-xs font-semibold text-neutral-300 hover:text-white"
              >
                View All →
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-neutral-400">No orders found.</p>
                <Link href="/products" className="btn-primary mt-4 !text-xs">
                  Explore Products Catalog
                </Link>
              </div>
            ) : (
              <>
              {/* Mobile cards */}
              <div className="mt-4 space-y-2.5 sm:hidden">
                {orders.slice(0, 5).map((order) => {
                  const isExpired =
                    order.status === "expired" ||
                    (order.status === "pending" &&
                      order.expiresAt &&
                      new Date(order.expiresAt) <= new Date());
                  const isPendingActive = order.status === "pending" && !isExpired;
                  const displayStatus = isExpired ? "expired" : order.status;

                  return (
                    <div
                      key={order._id}
                      onClick={() => setSelectedOrder(order)}
                      className="rounded-lg border border-theme-border bg-black/40 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {order.productName || order.product?.name || "Product"}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
                            #{String(order._id).slice(-8)}
                          </p>
                        </div>
                        {renderStatusBadge(displayStatus)}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-white">
                          {formatPrice(order.price || order.amount)}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {timeAgo(order.createdAt)}
                        </span>
                      </div>
                      <div className="mt-3">
                        {isPendingActive ? (
                          <Link
                            href={`/checkout/${order._id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="btn-primary min-h-[44px] w-full !text-xs font-bold"
                          >
                            Pay Now →
                          </Link>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                            className="btn-ghost min-h-[44px] w-full !text-xs"
                          >
                            View Details
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-theme-border/50 text-neutral-400">
                      <th className="py-2.5 font-medium">Order ID</th>
                      <th className="py-2.5 font-medium">Product</th>
                      <th className="py-2.5 font-medium">Price</th>
                      <th className="py-2.5 font-medium">Status</th>
                      <th className="py-2.5 font-medium">Date</th>
                      <th className="py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orders.slice(0, 5).map((order) => {
                      const isExpired =
                        order.status === "expired" ||
                        (order.status === "pending" &&
                          order.expiresAt &&
                          new Date(order.expiresAt) <= new Date());
                      const isPendingActive = order.status === "pending" && !isExpired;
                      const displayStatus = isExpired ? "expired" : order.status;

                      return (
                        <tr
                          key={order._id}
                          className="transition hover:bg-white/5 cursor-pointer"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <td className="py-3 font-mono text-neutral-300">
                            #{String(order._id).slice(-8)}
                          </td>
                          <td className="py-3 font-semibold text-white">
                            <div>{order.productName || order.product?.name || "Product"}</div>
                            {order.plan?.label && (
                              <span className="inline-block mt-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">
                                {order.plan.label} {Number(order.plan.days) > 0 ? `(${order.plan.days}d)` : "(Lifetime)"}
                              </span>
                            )}
                          </td>
                          <td className="py-3 font-mono font-medium text-white">
                            {formatPrice(order.price || order.amount)}
                          </td>
                          <td className="py-3">{renderStatusBadge(displayStatus)}</td>
                          <td className="py-3 text-neutral-400">{timeAgo(order.createdAt)}</td>
                          <td className="py-3 text-right">
                            {isPendingActive ? (
                              <Link
                                href={`/checkout/${order._id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="btn-primary inline-block !px-2.5 !py-1 !text-[11px] font-bold"
                              >
                                Pay Now →
                              </Link>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrder(order);
                                }}
                                className="rounded border border-theme-border px-2.5 py-1 text-[11px] font-medium text-neutral-300 hover:bg-white/10 hover:text-white"
                              >
                                Details
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: MY ORDERS ── */}
      {activeTab === "orders" && (
        <div className="mt-8 space-y-6">
          <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search orders by ID or product name..."
                className="w-full rounded-lg border border-theme-border bg-black/60 py-2 pl-3 pr-8 text-xs text-white placeholder-neutral-500 outline-none focus:border-theme-border-hover"
              />
              {orderSearch && (
                <button
                  onClick={() => setOrderSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto">
              {["all", "pending", "paid", "processing", "completed", "expired", "cancelled"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                    statusFilter === st
                      ? "btn-primary !px-3 !py-1.5 !text-[11px]"
                      : "border border-theme-border bg-theme-surface text-neutral-400 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Delivery Cards */}
          {licenseOrders.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Your Deliveries</h2>
                  <p className="text-xs text-neutral-400">
                    Delivery details for your verified payments. Keep them private.
                  </p>
                </div>
              </div>

              {licenseNotice && (
                <div
                  className={`rounded-lg border p-3 text-xs ${
                    licenseNotice.type === "success"
                      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                      : "border-red-500/30 bg-red-950/40 text-red-300"
                  }`}
                >
                  {licenseNotice.text}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {licenseOrders.map((order) => {
                  const isContent = order.deliveryType === "content";
                  const delivery = order.deliveryContent || null;
                  const hasKey = Boolean(order.licenseKey);
                  const hasDelivery = isContent ? Boolean(delivery) : hasKey;
                  const isProcessing =
                    !hasDelivery &&
                    ["paid", "processing", "completed"].includes(order.status);
                  const isBusy = licenseBusyId === order._id;
                  const needsDiscordLink =
                    !isDiscordLinked && order.status === "completed";

                  return (
                    <div key={order._id} className="glass p-5">
                      <div className="flex items-start justify-between gap-3 border-b border-theme-border/50 pb-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-white">
                            {order.productName || order.product?.name || "Product"}
                          </h3>
                          <p className="mt-0.5 text-[11px] text-neutral-400">
                            {order.plan?.label || "Plan"}{" "}
                            {Number(order.plan?.days) > 0
                              ? `(${order.plan.days} days)`
                              : "(Lifetime)"}
                          </p>
                        </div>
                        <div className="shrink-0">{renderStatusBadge(order.status)}</div>
                      </div>

                      {isContent && delivery ? (
                        <div className="mt-4 space-y-3">
                          {delivery.title && (
                            <div>
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                {delivery.title}
                              </span>
                            </div>
                          )}

                          {delivery.message && (
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                  Delivery Message
                                </span>
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      delivery.message,
                                      `content-message-${order._id}`
                                    )
                                  }
                                  className="rounded border border-theme-border px-2 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
                                >
                                  {copiedId === `content-message-${order._id}`
                                    ? "Copied"
                                    : "Copy"}
                                </button>
                              </div>
                              <p className="mt-1.5 whitespace-pre-wrap break-words rounded-lg border border-theme-border bg-black/60 px-3 py-2 text-[11px] leading-relaxed text-neutral-200">
                                {delivery.message}
                              </p>
                            </div>
                          )}

                          {delivery.link && (
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                  Delivery Link
                                </span>
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      delivery.link,
                                      `content-link-${order._id}`
                                    )
                                  }
                                  className="rounded border border-theme-border px-2 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
                                >
                                  {copiedId === `content-link-${order._id}`
                                    ? "Copied"
                                    : "Copy Link"}
                                </button>
                              </div>
                              <a
                                href={delivery.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary mt-1.5 inline-flex !px-3 !py-1.5 !text-[11px] font-bold"
                              >
                                {delivery.buttonLabel || "Open Link"}
                              </a>
                            </div>
                          )}

                          {delivery.stockItem && (
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                  Your Item
                                </span>
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      delivery.stockItem,
                                      `content-stock-${order._id}`
                                    )
                                  }
                                  className="rounded border border-theme-border px-2 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
                                >
                                  {copiedId === `content-stock-${order._id}`
                                    ? "Copied"
                                    : "Copy"}
                                </button>
                              </div>
                              <code className="mt-1.5 block whitespace-pre-wrap break-all rounded-lg border border-theme-border bg-black/60 px-3 py-2 font-mono text-[11px] text-emerald-300">
                                {delivery.stockItem}
                              </code>
                            </div>
                          )}

                          <p className="text-[10px] text-amber-300/80">
                            Keep these delivery details private. Do not share them
                            publicly.
                          </p>
                          {order.deliveryError && (
                            <p className="text-[10px] text-red-300/90 break-words">
                              {order.deliveryError}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 pt-1">
                            <a
                              href={discordInvite}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost !px-3 !py-1.5 !text-[11px]"
                            >
                              Support
                            </a>
                            <WhatsAppSupport
                              message={whatsappMessageFor(order)}
                              label="WhatsApp"
                              className="!px-3 !py-1.5 !text-[11px]"
                            />
                            {needsDiscordLink ? (
                              <a
                                href="/api/account/link/discord/start"
                                className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20"
                              >
                                Discord link karo, DM paane ke liye
                              </a>
                            ) : (
                              <button
                                onClick={() => handleResendDM(order)}
                                disabled={resendBusyId === order._id}
                                className="rounded-lg border border-theme-border px-3 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
                                title="Resend the delivery details to your Discord DM (once per 5 minutes)"
                              >
                                {resendBusyId === order._id ? "Sending..." : "Resend DM"}
                              </button>
                            )}
                          </div>
                          {needsDiscordLink && (
                            <p className="text-[10px] text-sky-300/80">
                              Delivery details dashboard me safe hain. DM delivery ke
                              liye Discord link karo.
                            </p>
                          )}
                          {order.dmSent === false && order.dmError && (
                            <p className="text-[10px] text-amber-400/80">
                              DM delivery failed. You can retry with Resend DM.
                            </p>
                          )}
                        </div>
                      ) : hasKey ? (
                        <div className="mt-4 space-y-3">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                              License Key
                            </span>
                            <div className="mt-1.5 flex items-start gap-2">
                              <code className="min-w-0 flex-1 break-all rounded-lg border border-theme-border bg-black/60 px-3 py-2 font-mono text-[11px] text-emerald-300">
                                {order.licenseKey}
                              </code>
                              <button
                                onClick={() =>
                                  copyToClipboard(order.licenseKey, `key-${order._id}`)
                                }
                                className="shrink-0 rounded-lg border border-theme-border px-2.5 py-2 text-[11px] font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
                              >
                                {copiedId === `key-${order._id}` ? "Copied" : "Copy"}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1 text-[11px] text-neutral-400">
                            <p>
                              <span className="text-neutral-500">Expiry:</span>{" "}
                              <span className="text-neutral-300">{planExpiryLabel(order)}</span>
                            </p>
                            <p className="text-amber-300/90">
                              1 device only. HWID reset is not available.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <a
                              href="/api/loader"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary !px-3 !py-1.5 !text-[11px] font-bold"
                            >
                              Download Loader
                            </a>
                            <a
                              href={discordInvite}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-ghost !px-3 !py-1.5 !text-[11px]"
                            >
                              Support
                            </a>
                            <WhatsAppSupport
                              message={whatsappMessageFor(order)}
                              label="WhatsApp"
                              className="!px-3 !py-1.5 !text-[11px]"
                            />
                            {needsDiscordLink ? (
                              <a
                                href="/api/account/link/discord/start"
                                className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20"
                              >
                                Discord link karo, DM paane ke liye
                              </a>
                            ) : (
                              <button
                                onClick={() => handleResendDM(order)}
                                disabled={resendBusyId === order._id}
                                className="rounded-lg border border-theme-border px-3 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
                                title="Resend the license key to your Discord DM (once per 5 minutes)"
                              >
                                {resendBusyId === order._id ? "Sending..." : "Resend DM"}
                              </button>
                            )}
                          </div>
                          {needsDiscordLink && (
                            <p className="text-[10px] text-sky-300/80">
                              License dashboard me safe hai. DM delivery ke liye Discord link karo.
                            </p>
                          )}
                          {order.dmSent === false && order.dmError && (
                            <p className="text-[10px] text-amber-400/80">
                              DM delivery failed. You can retry with Resend DM.
                            </p>
                          )}
                        </div>
                      ) : isProcessing ? (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[11px] font-semibold text-sky-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                            Processing your delivery...
                          </div>
                          {order.licenseError && (
                            <p className="text-[10px] text-red-300/90 break-words">
                              {order.licenseError}
                            </p>
                          )}
                          {order.deliveryError && (
                            <p className="text-[10px] text-red-300/90 break-words">
                              {order.deliveryError}
                            </p>
                          )}
                          <button
                            onClick={() => handleRetryLicense(order)}
                            disabled={isBusy}
                            className="btn-primary !px-3 !py-1.5 !text-[11px] font-bold"
                          >
                            {isBusy ? "Retrying..." : "Retry Delivery"}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-4 text-[11px] text-neutral-500">
                          No delivery details available for this order yet.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="glass p-6">
            {filteredOrders.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-xs text-neutral-400">No matching orders found.</p>
                <button
                  onClick={() => {
                    setOrderSearch("");
                    setStatusFilter("all");
                  }}
                  className="btn-ghost mt-4 !text-xs"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <>
              {/* Mobile cards */}
              <div className="space-y-2.5 sm:hidden">
                {filteredOrders.map((order) => {
                  const isExpired =
                    order.status === "expired" ||
                    (order.status === "pending" &&
                      order.expiresAt &&
                      new Date(order.expiresAt) <= new Date());
                  const isPendingActive = order.status === "pending" && !isExpired;
                  const displayStatus = isExpired ? "expired" : order.status;

                  return (
                    <div
                      key={order._id}
                      className="rounded-lg border border-theme-border bg-black/40 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {order.productName || order.product?.name || "Product"}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
                            #{String(order._id).slice(-8)}
                            {order.utr ? ` · UTR ${order.utr}` : ""}
                          </p>
                        </div>
                        {renderStatusBadge(displayStatus)}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-white">
                          {formatPrice(order.price || order.amount)}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {isPendingActive ? (
                          <Link
                            href={`/checkout/${order._id}`}
                            className="btn-primary min-h-[44px] flex-1 !text-xs font-bold"
                          >
                            Pay Now →
                          </Link>
                        ) : (
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="btn-ghost min-h-[44px] flex-1 !text-xs"
                          >
                            View Receipt
                          </button>
                        )}
                        <WhatsAppSupport
                          message={whatsappMessageFor(order)}
                          label="Help"
                          className="min-h-[44px]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-theme-border/50 text-neutral-400">
                      <th className="py-3 font-medium">Order ID</th>
                      <th className="py-3 font-medium">Product</th>
                      <th className="py-3 font-medium">Price</th>
                      <th className="py-3 font-medium">Status</th>
                      <th className="py-3 font-medium">Date Placed</th>
                      <th className="py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredOrders.map((order) => {
                      const isExpired =
                        order.status === "expired" ||
                        (order.status === "pending" &&
                          order.expiresAt &&
                          new Date(order.expiresAt) <= new Date());
                      const isPendingActive = order.status === "pending" && !isExpired;
                      const displayStatus = isExpired ? "expired" : order.status;

                      return (
                        <tr
                          key={order._id}
                          className="transition hover:bg-white/5 cursor-pointer"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <td className="py-3.5">
                            <div className="flex items-center gap-1.5 font-mono text-neutral-300">
                              <span>#{String(order._id).slice(-8)}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(String(order._id), order._id);
                                }}
                                className="text-neutral-500 hover:text-white"
                                title="Copy full ID"
                              >
                                {copiedId === order._id ? "✓" : "📋"}
                              </button>
                            </div>
                            {order.utr && (
                              <span className="block font-mono text-[10px] text-amber-300 mt-0.5">
                                UTR: {order.utr}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 font-semibold text-white">
                            <div>{order.productName || order.product?.name || "Product"}</div>
                            {order.plan?.label && (
                              <span className="inline-block mt-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">
                                {order.plan.label} {Number(order.plan.days) > 0 ? `(${order.plan.days}d)` : "(Lifetime)"}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 font-mono font-bold text-white">
                            {formatPrice(order.price || order.amount)}
                          </td>
                          <td className="py-3.5">
                            <div>{renderStatusBadge(displayStatus)}</div>
                            {isPendingActive && order.expiresAt && (
                              <span className="block mt-0.5 font-mono text-[10px] text-amber-300">
                                Expires: {new Date(order.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-neutral-400">
                            {new Date(order.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isPendingActive ? (
                                <Link
                                  href={`/checkout/${order._id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="btn-primary !px-3 !py-1 !text-xs font-bold shadow-sm"
                                >
                                  Pay Now →
                                </Link>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrder(order);
                                  }}
                                  className="rounded border border-theme-border px-3 py-1 text-xs font-medium text-neutral-200 hover:bg-white/10 hover:text-white"
                                >
                                  View Receipt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: HISTORY ── */}
      {activeTab === "history" && (
        <div className="glass mt-8 p-8">
          <div className="border-b border-theme-border/50 pb-4">
            <h2 className="text-base font-bold text-white">Account & Activity Timeline</h2>
            <p className="text-xs text-neutral-400">Complete audit log of all account milestones and purchases</p>
          </div>

          <div className="relative mt-8 space-y-8 pl-6 before:absolute before:bottom-0 before:left-2.5 before:top-2 before:w-px before:bg-theme-border">
            {historyEvents.map((ev, i) => (
              <div key={i} className="relative">
                <span
                  className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2"
                  style={{ backgroundColor: "var(--accent-primary)", borderColor: "var(--bg-base)" }}
                />
                <div>
                  <span className="font-mono text-[11px] text-neutral-500">
                    {ev.date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <h3 className="mt-0.5 text-sm font-semibold text-white">{ev.title}</h3>
                  <p className="mt-1 text-xs text-neutral-400">{ev.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: PROFILE ── */}
      {activeTab === "profile" && (
        <div className="glass mt-8 max-w-2xl p-8">
          <div className="border-b border-theme-border/50 pb-4">
            <h2 className="text-base font-bold text-white">Account Profile</h2>
            <p className="text-xs text-neutral-400">Verified sign-in methods and account details</p>
          </div>

          {accountNotice && (
            <div
              className={`mt-4 rounded-lg border p-3 text-xs ${
                accountNotice.type === "success"
                  ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                  : "border-red-500/30 bg-red-950/40 text-red-300"
              }`}
            >
              {accountNotice.text}
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-theme-border bg-theme-surface">
              {userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-mono text-2xl font-bold text-white">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{userName}</h3>
              <p className="text-xs text-neutral-400">{maskEmail(user.email || dbUser?.email)}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="badge-theme px-2 py-0.5 text-[10px] font-bold uppercase">
                  Role: {userRole}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4 rounded-lg border border-theme-border bg-black/60 p-5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-400">Discord</span>
              {isDiscordLinked ? (
                <div className="flex items-center gap-2 font-mono text-white">
                  <span>{linkedDiscordId}</span>
                  <button
                    onClick={() => copyToClipboard(linkedDiscordId, "profile-id")}
                    className="text-neutral-500 hover:text-white"
                  >
                    {copiedId === "profile-id" ? "✓" : "Copy"}
                  </button>
                </div>
              ) : (
                <a
                  href="/api/account/link/discord/start"
                  className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 font-semibold text-sky-300 hover:bg-sky-500/20"
                >
                  Link Discord
                </a>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
              <span className="text-neutral-400">Google</span>
              {isGoogleLinked ? (
                <span className="font-mono text-white">
                  {googleEmail ? maskEmail(googleEmail) : "Linked"}
                </span>
              ) : (
                <a
                  href="/api/account/link/google/start"
                  className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 font-semibold text-sky-300 hover:bg-sky-500/20"
                >
                  Link Google
                </a>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
              <div className="pr-3">
                <p className="text-neutral-400">Homepage par meri photo dikhao</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                  Show my Google profile photo in the homepage “Joined with Google” row.
                </p>
                {visibilityError && (
                  <p className="mt-1 text-[10px] text-red-300">{visibilityError}</p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showOnHomepage}
                aria-label="Homepage par meri photo dikhao"
                onClick={handleHomepageVisibilityToggle}
                disabled={visibilityBusy}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                  showOnHomepage
                    ? "border-white bg-white"
                    : "border-theme-border bg-white/10"
                } ${visibilityBusy ? "cursor-wait opacity-60" : ""}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                    showOnHomepage
                      ? "translate-x-6 bg-black"
                      : "translate-x-1 bg-white/70"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
              <span className="text-neutral-400">Account ID</span>
              <div className="flex min-w-0 items-center gap-2 font-mono text-white">
                <span className="truncate">{accountId}</span>
                <button
                  onClick={() => copyToClipboard(accountId, "profile-account-id")}
                  className="shrink-0 text-neutral-500 hover:text-white"
                >
                  {copiedId === "profile-account-id" ? "✓" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-neutral-400">Email Address (Masked)</span>
              <span className="font-mono text-white">{maskEmail(user.email || dbUser?.email)}</span>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-neutral-400">Member Since</span>
              <span className="text-white">{memberSince}</span>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-neutral-400">Authentication Source</span>
              <span className="text-white">{accountSources}</span>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-neutral-500">
            Link both Google and Discord to sign in either way and keep every order on one account.
          </p>
        </div>
      )}

      {/* ── Order Details Modal ── */}
      <AnimatePresence>
        {selectedOrder && (
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
                <div>
                  <h3 className="text-sm font-bold text-white">Order Receipt Details</h3>
                  <p className="font-mono text-[11px] text-neutral-400">
                    #{String(selectedOrder._id)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-neutral-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-3 rounded-lg border border-theme-border bg-black/60 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Product:</span>
                  <span className="font-semibold text-white">
                    {selectedOrder.productName || selectedOrder.product?.name || "Product"}
                  </span>
                </div>
                {selectedOrder.plan?.label && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Plan Duration:</span>
                    <span className="font-semibold text-white">
                      {selectedOrder.plan.label} {Number(selectedOrder.plan.days) > 0 ? `(${selectedOrder.plan.days} Days)` : "(Lifetime)"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-400">Total Price:</span>
                  <span className="font-mono font-bold text-white">
                    {formatPrice(selectedOrder.price || selectedOrder.amount)}
                  </span>
                </div>
                {selectedOrder.utr && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Submitted UTR:</span>
                    <span className="font-mono font-bold text-amber-300">
                      {selectedOrder.utr}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Fulfillment Status:</span>
                  <div>{renderStatusBadge(selectedOrder.status)}</div>
                </div>
                {selectedOrder.deliveryType === "content" &&
                selectedOrder.deliveryContent ? (
                  <div className="space-y-3 border-t border-white/5 pt-3">
                    {selectedOrder.deliveryContent.title && (
                      <span className="block font-semibold text-neutral-300">
                        {selectedOrder.deliveryContent.title}
                      </span>
                    )}
                    {selectedOrder.deliveryContent.message && (
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-neutral-400">Message:</span>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                selectedOrder.deliveryContent.message,
                                `modal-content-message-${selectedOrder._id}`
                              )
                            }
                            className="rounded border border-theme-border px-2 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
                          >
                            {copiedId ===
                            `modal-content-message-${selectedOrder._id}`
                              ? "Copied"
                              : "Copy"}
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap break-words rounded-lg border border-theme-border bg-black/60 px-3 py-2 text-[11px] leading-relaxed text-neutral-200">
                          {selectedOrder.deliveryContent.message}
                        </p>
                      </div>
                    )}
                    {selectedOrder.deliveryContent.link && (
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-neutral-400">Link:</span>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                selectedOrder.deliveryContent.link,
                                `modal-content-link-${selectedOrder._id}`
                              )
                            }
                            className="rounded border border-theme-border px-2 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
                          >
                            {copiedId ===
                            `modal-content-link-${selectedOrder._id}`
                              ? "Copied"
                              : "Copy"}
                          </button>
                        </div>
                        <a
                          href={selectedOrder.deliveryContent.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary inline-flex !px-3 !py-1.5 !text-[11px] font-bold"
                        >
                          {selectedOrder.deliveryContent.buttonLabel || "Open Link"}
                        </a>
                      </div>
                    )}
                    {selectedOrder.deliveryContent.stockItem && (
                      <div>
                        <span className="mb-1 block text-neutral-400">Your Item:</span>
                        <code className="block whitespace-pre-wrap break-all rounded-lg border border-theme-border bg-black/60 px-3 py-2 font-mono text-[11px] text-emerald-300">
                          {selectedOrder.deliveryContent.stockItem}
                        </code>
                      </div>
                    )}
                    <p className="text-[10px] text-amber-300/90">
                      Keep these delivery details private. Do not share them
                      publicly.
                    </p>
                  </div>
                ) : selectedOrder.licenseKey ? (
                  <div className="border-t border-white/5 pt-3">
                    <span className="mb-1.5 block text-neutral-400">License Key:</span>
                    <div className="flex items-start gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-lg border border-theme-border bg-black/60 px-3 py-2 font-mono text-[11px] text-emerald-300">
                        {selectedOrder.licenseKey}
                      </code>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            selectedOrder.licenseKey,
                            `modal-key-${selectedOrder._id}`
                          )
                        }
                        className="shrink-0 rounded-lg border border-theme-border px-2.5 py-2 text-[11px] font-semibold text-neutral-300 hover:bg-white/10 hover:text-white"
                      >
                        {copiedId === `modal-key-${selectedOrder._id}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-amber-300/90">
                      1 device only. HWID reset is not available.
                    </p>
                  </div>
                ) : ["paid", "processing", "completed"].includes(
                    selectedOrder.status
                  ) ? (
                  <div className="border-t border-white/5 pt-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-sky-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                      Processing your delivery...
                    </div>
                    {selectedOrder.licenseError && (
                      <p className="mt-1 text-[10px] text-red-300/90">
                        {selectedOrder.licenseError}
                      </p>
                    )}
                    {selectedOrder.deliveryError && (
                      <p className="mt-1 text-[10px] text-red-300/90">
                        {selectedOrder.deliveryError}
                      </p>
                    )}
                    <button
                      onClick={() => handleRetryLicense(selectedOrder)}
                      disabled={licenseBusyId === selectedOrder._id}
                      className="btn-primary mt-2 !px-3 !py-1.5 !text-[11px] font-bold"
                    >
                      {licenseBusyId === selectedOrder._id ? "Retrying..." : "Retry Delivery"}
                    </button>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-neutral-400">Order Placed:</span>
                  <span className="text-white">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </span>
                </div>
                {selectedOrder.notes && (
                  <div className="border-t border-white/5 pt-2">
                    <span className="text-neutral-400 block mb-1">Notes:</span>
                    <p className="text-neutral-300 italic">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                {selectedOrder.status === "pending" && (
                  <Link
                    href={`/checkout/${selectedOrder._id}`}
                    className="btn-primary flex-1 !py-2.5 !text-xs font-bold text-center"
                  >
                    Complete UPI Payment →
                  </Link>
                )}
                <a
                  href={`${discordInvite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${selectedOrder.status === "pending" ? "btn-ghost" : "btn-primary"} flex-1 !py-2.5 !text-xs font-semibold text-center`}
                >
                  <DiscordIcon className="h-4 w-4" />
                  Discord Desk
                </a>
                <WhatsAppSupport
                  message={whatsappMessageFor(selectedOrder)}
                  label="WhatsApp"
                  className="flex-1 !py-2.5 !text-xs"
                />
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="btn-ghost flex-1 !py-2.5 !text-xs"
                >
                  Close Receipt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
