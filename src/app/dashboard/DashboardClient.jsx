"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice, timeAgo } from "@/lib/format";
import CountUp from "@/components/CountUp";
import { DiscordIcon } from "@/components/Navbar";

export default function DashboardClient({
  session,
  dbUser,
  orders = [],
  stats = { totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalSpent: 0 },
  initialTab = "overview",
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") || initialTab || "overview";
  const [activeTab, setActiveTab] = useState(tabParam);

  // Orders tab search and filter
  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedId, setCopiedId] = useState(null);

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
  const discordId = user.id || dbUser?.discordId || "N/A";
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
        desc: "Authenticated via Discord and registered in store system.",
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
              <span className="font-mono">ID: {discordId}</span>
              <button
                onClick={() => copyToClipboard(discordId, "user-id")}
                className="text-[11px] text-neutral-400 hover:text-white"
                title="Copy Discord ID"
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
              <div className="mt-4 overflow-x-auto">
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
              {["all", "pending", "paid", "completed", "expired", "cancelled"].map((st) => (
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
              <div className="overflow-x-auto">
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
            <h2 className="text-base font-bold text-white">Discord Profile Information</h2>
            <p className="text-xs text-neutral-400">Verified credentials authenticated from your Discord OAuth session</p>
          </div>

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
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Discord ID</span>
              <div className="flex items-center gap-2 font-mono text-white">
                <span>{discordId}</span>
                <button
                  onClick={() => copyToClipboard(discordId, "profile-id")}
                  className="text-neutral-500 hover:text-white"
                >
                  {copiedId === "profile-id" ? "✓" : "Copy"}
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
              <span className="text-white">Discord OAuth2 (RFC 9207)</span>
            </div>
          </div>
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
