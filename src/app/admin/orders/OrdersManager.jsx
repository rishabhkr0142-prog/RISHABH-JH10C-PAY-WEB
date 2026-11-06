"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { formatPrice, timeAgo } from "@/lib/format";

const STATUSES = ["pending", "paid", "processing", "completed", "expired", "cancelled"];

export default function OrdersManager({
  orders = [],
  products = [],
  payments = [],
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState("orders"); // 'orders' | 'payments' | 'unclaimed'
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [confirmModal, setConfirmModal] = useState(null);
  const [revealedKeys, setRevealedKeys] = useState({});
  const [retryBusyId, setRetryBusyId] = useState(null);
  const [resendBusyId, setResendBusyId] = useState(null);
  const [resendWebhookBusyId, setResendWebhookBusyId] = useState(null);
  const [deliveryEditOrder, setDeliveryEditOrder] = useState(null);
  const [deliveryForm, setDeliveryForm] = useState({
    deliveryTitle: "",
    deliveryLink: "",
    deliveryMessage: "",
    deliveryButtonLabel: "",
  });
  const [deliveryBusy, setDeliveryBusy] = useState(false);

  // Manual payment match modal
  const [matchingPayment, setMatchingPayment] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [matchingBusy, setMatchingBusy] = useState(false);

  // Payment soft-delete / restore state
  const [paymentRows, setPaymentRows] = useState(payments);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [restoreBusyId, setRestoreBusyId] = useState(null);
  const [undoToast, setUndoToast] = useState(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const undoTimerRef = useRef(null);

  // Keep the optimistic payment list in sync with fresh server data.
  useEffect(() => {
    setPaymentRows(payments);
  }, [payments]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setSelectedPaymentIds([]);
  }, [viewMode]);

  // Legacy LIB orders that may hold a key from the wrong auth app
  const [suspectOrders, setSuspectOrders] = useState([]);
  const [suspectLoading, setSuspectLoading] = useState(false);
  const [suspectError, setSuspectError] = useState("");
  const [suspectNote, setSuspectNote] = useState("");

  const [form, setForm] = useState({
    customerName: "",
    email: "",
    discordId: "",
    productId: "",
    quantity: 1,
    amount: "",
    status: "pending",
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const activePayments = useMemo(() => {
    return paymentRows.filter((p) => p.status !== "deleted" && !p.archived);
  }, [paymentRows]);

  const unclaimedPayments = useMemo(() => {
    return activePayments.filter((p) => p.status === "unclaimed");
  }, [activePayments]);

  const deletedPayments = useMemo(() => {
    return paymentRows.filter((p) => p.status === "deleted" || p.archived);
  }, [paymentRows]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not create order");
      }
      setForm({
        customerName: "",
        email: "",
        discordId: "",
        productId: "",
        quantity: 1,
        amount: "",
        status: "pending",
      });
      setShowForm(false);
      setSuccessMsg("Order created successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (order, newStatus) => {
    if (newStatus === "cancelled") {
      setConfirmModal({
        title: "Cancel Order?",
        message: `Are you sure you want to cancel order #${String(order._id).slice(-8)} for ${order.customerName || "Customer"}?`,
        onConfirm: async () => {
          setConfirmModal(null);
          await updateOrderStatus(order._id, newStatus);
        },
      });
      return;
    }

    await updateOrderStatus(order._id, newStatus);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    setBusyId(orderId);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (order) => {
    setConfirmModal({
      title: "Permanently Delete Order?",
      message: `This will remove order #${String(order._id).slice(-8)} from the database and decrement total store orders. This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        setBusyId(order._id);
        setError("");
        try {
          const res = await fetch(`/api/admin/orders/${order._id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Delete failed");
          }
          router.refresh();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  // Perform manual match between unclaimed payment and order
  const handleConfirmMatch = async () => {
    if (!matchingPayment || !selectedOrderId.trim()) {
      setError("Please select or enter an Order ID to link.");
      return;
    }

    setMatchingBusy(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/payments/${matchingPayment._id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selectedOrderId.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to link payment");
      }

      setSuccessMsg(data.message || "Payment successfully matched to order!");
      setTimeout(() => setSuccessMsg(""), 4000);
      setMatchingPayment(null);
      setSelectedOrderId("");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setMatchingBusy(false);
    }
  };

  const showUndoToast = (ids) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ ids, label: `${ids.length} payment${ids.length > 1 ? "s" : ""} deleted.` });
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
      undoTimerRef.current = null;
    }, 10000);
  };

  const openDeletePayment = (payment) => {
    setError("");
    setDeleteReason("");
    setDeleteTarget({ ids: [payment._id], payments: [payment] });
  };

  const openDeleteSelected = () => {
    const selected = unclaimedPayments.filter((p) =>
      selectedPaymentIds.includes(p._id)
    );
    if (selected.length === 0) {
      setError("Select at least one unclaimed payment to delete.");
      return;
    }
    if (selected.length > 50) {
      setError("You can delete up to 50 payments at a time.");
      return;
    }
    setError("");
    setDeleteReason("");
    setDeleteTarget({ ids: selected.map((p) => p._id), payments: selected });
  };

  const handleConfirmDeletePayments = async () => {
    if (!deleteTarget?.ids?.length) return;

    setDeleteBusy(true);
    setError("");
    const ids = deleteTarget.ids;

    try {
      const res =
        ids.length === 1
          ? await fetch(`/api/admin/payments/${ids[0]}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: deleteReason.trim() }),
            })
          : await fetch("/api/admin/payments/bulk-action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "delete",
                ids,
                reason: deleteReason.trim(),
              }),
            });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not delete payment(s).");
      }

      const deletedIds = (data.deletedIds || ids).map(String);
      const nowIso = new Date().toISOString();

      // Optimistically hide/update rows immediately; the badge re-counts too.
      setPaymentRows((prev) =>
        prev.map((p) =>
          deletedIds.includes(String(p._id))
            ? {
                ...p,
                status: "deleted",
                archived: true,
                deletedAt: nowIso,
                deleteReason: deleteReason.trim(),
              }
            : p
        )
      );
      setSelectedPaymentIds((prev) =>
        prev.filter((id) => !deletedIds.includes(String(id)))
      );
      setDeleteTarget(null);
      setDeleteReason("");

      if (data.skipped > 0) {
        setError(
          `${data.skipped} payment(s) were skipped because they are no longer unclaimed.`
        );
      }

      showUndoToast(deletedIds);
      setSuccessMsg(
        `${deletedIds.length} payment${deletedIds.length > 1 ? "s" : ""} deleted from the unclaimed list.`
      );
      setTimeout(() => setSuccessMsg(""), 4000);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleRestorePayment = async (payment) => {
    setRestoreBusyId(payment._id);
    setError("");
    try {
      const res = await fetch(`/api/admin/payments/${payment._id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Restored from admin panel" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not restore payment.");
      }

      setPaymentRows((prev) =>
        prev.map((p) =>
          String(p._id) === String(payment._id)
            ? {
                ...p,
                status: "unclaimed",
                archived: false,
                deletedAt: null,
                deletedBy: "",
                deleteReason: "",
              }
            : p
        )
      );
      setSuccessMsg(`Payment ${payment.utr} restored to unclaimed.`);
      setTimeout(() => setSuccessMsg(""), 4000);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoreBusyId(null);
    }
  };

  const handleUndoDelete = async () => {
    if (!undoToast?.ids?.length) return;

    const ids = undoToast.ids;
    setUndoBusy(true);
    setError("");
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    try {
      const res = await fetch("/api/admin/payments/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          ids,
          reason: "Undo delete",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not undo the delete.");
      }

      const restoredIds = (data.restoredIds || ids).map(String);
      setPaymentRows((prev) =>
        prev.map((p) =>
          restoredIds.includes(String(p._id))
            ? {
                ...p,
                status: "unclaimed",
                archived: false,
                deletedAt: null,
                deletedBy: "",
                deleteReason: "",
              }
            : p
        )
      );

      setUndoToast(null);
      setSuccessMsg(
        `${restoredIds.length} payment${restoredIds.length > 1 ? "s" : ""} restored to unclaimed.`
      );
      setTimeout(() => setSuccessMsg(""), 4000);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setUndoToast(null);
    } finally {
      setUndoBusy(false);
    }
  };

  const handleRetryLicense = async (order) => {
    setRetryBusyId(order._id);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order._id}/retry-license`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "License retry failed");
      }
      setSuccessMsg(
        data.alreadyCompleted
          ? "This order already has delivery details."
          : "Delivery completed and sent."
      );
      setTimeout(() => setSuccessMsg(""), 4000);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setRetryBusyId(null);
    }
  };

  const handleResendDM = async (order) => {
    setResendBusyId(order._id);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order._id}/resend-dm`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not resend the DM");
      }
      setSuccessMsg("Delivery details sent to the buyer's Discord DM.");
      setTimeout(() => setSuccessMsg(""), 4000);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setResendBusyId(null);
    }
  };

  const handleResendSaleWebhook = async (order) => {
    setResendWebhookBusyId(order._id);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order._id}/resend-sale-webhook`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not resend the sale webhook");
      }
      setSuccessMsg("Sale notification webhook resent to Discord successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setResendWebhookBusyId(null);
    }
  };

  const openDeliveryEditor = (order) => {
    const content = order.deliveryContent || {};
    setDeliveryForm({
      deliveryTitle: content.title || "",
      deliveryLink: content.link || "",
      deliveryMessage: content.message || "",
      deliveryButtonLabel: content.buttonLabel || "",
    });
    setDeliveryEditOrder(order);
  };

  const handleSaveDelivery = async (e) => {
    e.preventDefault();
    if (!deliveryEditOrder) return;
    setDeliveryBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/orders/${deliveryEditOrder._id}/delivery`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deliveryForm),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not update delivery details");
      }
      setDeliveryEditOrder(null);
      setSuccessMsg("Delivery details updated for this order.");
      setTimeout(() => setSuccessMsg(""), 4000);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeliveryBusy(false);
    }
  };

  const handleLoadSuspects = async () => {
    setViewMode("suspects");
    setSearch("");
    setSuspectLoading(true);
    setSuspectError("");
    try {
      const res = await fetch("/api/admin/orders/suspect-licenses");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not load suspect orders");
      }
      setSuspectOrders(data.orders || []);
      setSuspectNote(data.note || "");
    } catch (err) {
      setSuspectError(err.message);
      setSuspectOrders([]);
    } finally {
      setSuspectLoading(false);
    }
  };

  const maskKey = (key) => {
    const value = String(key || "");
    if (!value) return "";
    if (value.length <= 8) return "•".repeat(value.length);
    return `${value.slice(0, 4)}${"•".repeat(Math.min(10, value.length - 8))}${value.slice(-4)}`;
  };

  const toggleReveal = (orderId) => {
    setRevealedKeys((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = filterStatus === "all" || o.status === filterStatus;
      if (!matchStatus) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const idMatch = String(o._id).toLowerCase().includes(q);
      const nameMatch = (o.customerName || "").toLowerCase().includes(q);
      const prodMatch = (o.productName || o.product?.name || "").toLowerCase().includes(q);
      const discordMatch = (o.discordId || "").toLowerCase().includes(q);
      const utrMatch = (o.utr || "").toLowerCase().includes(q);
      return idMatch || nameMatch || prodMatch || discordMatch || utrMatch;
    });
  }, [orders, search, filterStatus]);

  const filteredPayments = useMemo(() => {
    let list = paymentRows;
    if (viewMode === "unclaimed") {
      list = paymentRows.filter((p) => p.status === "unclaimed" && !p.archived);
    } else if (viewMode === "payments" && !showDeleted) {
      list = paymentRows.filter((p) => p.status !== "deleted" && !p.archived);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((p) => {
      const utrMatch = String(p.utr || "").toLowerCase().includes(q);
      const txnMatch = String(p.txnId || "").toLowerCase().includes(q);
      const payerMatch = String(p.payerUpi || "").toLowerCase().includes(q);
      const orderMatch = String(p.orderId || "").toLowerCase().includes(q);
      return utrMatch || txnMatch || payerMatch || orderMatch;
    });
  }, [paymentRows, viewMode, search, showDeleted]);

  const selectablePayments = useMemo(
    () =>
      viewMode === "unclaimed"
        ? filteredPayments.filter((p) => p.status === "unclaimed" && !p.archived)
        : [],
    [filteredPayments, viewMode]
  );

  const allSelectableSelected =
    selectablePayments.length > 0 &&
    selectablePayments.every((p) => selectedPaymentIds.includes(p._id));

  const toggleSelectAllPayments = () => {
    if (allSelectableSelected) {
      setSelectedPaymentIds([]);
    } else {
      setSelectedPaymentIds(selectablePayments.map((p) => p._id));
    }
  };

  const toggleSelectPayment = (paymentId) => {
    setSelectedPaymentIds((prev) =>
      prev.includes(paymentId)
        ? prev.filter((id) => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  const renderBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            pending
          </span>
        );
      case "completed":
        return (
          <span
            className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: "var(--accent-primary)", color: "var(--btn-primary-text)" }}
          >
            completed
          </span>
        );
      case "paid":
        return (
          <span className="badge-theme px-2 py-0.5 text-[10px] font-semibold">
            paid
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            processing
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex rounded-full border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
            expired
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
            cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex rounded-full border border-theme-border px-2 py-0.5 text-[10px] text-neutral-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Bar with View Mode Switcher ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Orders & UPI Payments</h2>
          <p className="mt-1 text-xs text-neutral-400">
            Real-time FamPay webhook verification, order fulfillment, and manual payment matching.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === "orders" && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="btn-primary !text-xs font-semibold"
            >
              {showForm ? "Cancel Form" : "+ Record Manual Order"}
            </button>
          )}
        </div>
      </div>

      {/* ── Primary View Tabs (Orders vs All Payments vs Unclaimed Payments) ── */}
      <div className="flex items-center gap-2 border-b border-theme-border pb-3">
        <button
          onClick={() => {
            setViewMode("orders");
            setSearch("");
          }}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            viewMode === "orders"
              ? "btn-primary !px-4 !py-2 !text-xs font-bold"
              : "border border-theme-border bg-theme-surface text-neutral-400 hover:text-white"
          }`}
        >
          Orders ({orders.length})
        </button>

        <button
          onClick={() => {
            setViewMode("payments");
            setSearch("");
          }}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            viewMode === "payments"
              ? "btn-primary !px-4 !py-2 !text-xs font-bold"
              : "border border-theme-border bg-theme-surface text-neutral-400 hover:text-white"
          }`}
        >
          All Payments ({paymentRows.length})
        </button>

        <button
          onClick={() => {
            setViewMode("unclaimed");
            setSearch("");
          }}
          className={`relative rounded-lg px-4 py-2 text-xs font-semibold transition ${
            viewMode === "unclaimed"
              ? "btn-primary !px-4 !py-2 !text-xs font-bold"
              : "border border-theme-border bg-theme-surface text-neutral-400 hover:text-white"
          }`}
        >
          <span>Unclaimed Payments</span>
          {unclaimedPayments.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/40">
              {unclaimedPayments.length}
            </span>
          )}
        </button>

        <button
          onClick={handleLoadSuspects}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            viewMode === "suspects"
              ? "btn-primary !px-4 !py-2 !text-xs font-bold"
              : "border border-red-500/30 bg-red-950/30 text-red-300 hover:bg-red-950/50"
          }`}
          title="List LIB Bypass orders that may have keys from the UID app"
        >
          Wrong-App Keys
          {viewMode === "suspects" && !suspectLoading && (
            <span className="ml-2 text-[10px] font-mono">({suspectOrders.length})</span>
          )}
        </button>
      </div>

      {/* ── Unclaimed Payments Alert Callout ── */}
      {unclaimedPayments.length > 0 && viewMode === "orders" && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-base text-amber-400">
              ⚠️
            </span>
            <div>
              <p className="font-bold text-amber-200">
                {unclaimedPayments.length} Unclaimed UPI Payment{unclaimedPayments.length > 1 ? "s" : ""} Received
              </p>
              <p className="text-[11px] text-amber-300/80">
                FamPay webhook logged payments that have not yet been claimed by an order.
              </p>
            </div>
          </div>
          <button
            onClick={() => setViewMode("unclaimed")}
            className="rounded-lg border border-amber-400/40 bg-amber-400/20 px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-400/30 transition text-xs"
          >
            Review & Match →
          </button>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300">
          {successMsg}
        </div>
      )}

      {/* ── Manual Order Form (Only on Orders view) ── */}
      <AnimatePresence>
        {showForm && viewMode === "orders" && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="glass p-6 space-y-4"
          >
            <h3 className="text-sm font-bold text-white">New Manual Order Record</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Customer Name</label>
                <input
                  type="text"
                  required
                  value={form.customerName}
                  onChange={set("customerName")}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Customer Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Discord ID</label>
                <input
                  type="text"
                  value={form.discordId}
                  onChange={set("discordId")}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Product</label>
                <select
                  value={form.productId}
                  onChange={set("productId")}
                  className="input"
                >
                  <option value="">Select a product...</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({formatPrice(p.price)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amount / Price</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={set("amount")}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  value={form.status}
                  onChange={set("status")}
                  className="input"
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary !text-xs"
              >
                {saving ? "Saving..." : "Create Order Record"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* ── Search & Filter Controls ── */}
      {viewMode !== "suspects" && (
      <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              viewMode === "orders"
                ? "Search by Order ID, UTR, Customer, Discord ID, or Product..."
                : "Search payments by UTR, Txn ID, or Payer UPI..."
            }
            className="w-full rounded-lg border border-theme-border bg-black/60 py-2 pl-3 pr-8 text-xs text-white placeholder-neutral-500 outline-none focus:border-theme-border-hover"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {viewMode === "orders" && (
          <div className="flex gap-1.5 overflow-x-auto">
            {["all", ...STATUSES].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                  filterStatus === st
                    ? "btn-primary !px-3 !py-1.5 !text-[11px]"
                    : "border border-theme-border bg-theme-surface text-neutral-400 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        {viewMode === "payments" && (
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[11px] font-semibold text-neutral-400">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="h-3.5 w-3.5 accent-red-500"
            />
            Show deleted ({deletedPayments.length})
          </label>
        )}
      </div>
      )}

      {/* ── Bulk selection toolbar (Unclaimed view) ── */}
      {viewMode === "unclaimed" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-theme-border bg-black/40 px-4 py-2.5 text-xs">
          <label className="flex cursor-pointer items-center gap-2 font-semibold text-neutral-300">
            <input
              type="checkbox"
              checked={allSelectableSelected}
              onChange={toggleSelectAllPayments}
              disabled={selectablePayments.length === 0}
              className="h-3.5 w-3.5 accent-red-500"
            />
            Select all
          </label>
          <span className="font-mono text-[11px] text-neutral-500">
            {selectedPaymentIds.length} selected
          </span>
          <button
            type="button"
            onClick={openDeleteSelected}
            disabled={selectedPaymentIds.length === 0}
            className="ml-auto rounded-md border border-red-500/50 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete selected
          </button>
        </div>
      )}

      {/* ── VIEW 1: ORDERS TABLE ── */}
      {viewMode === "orders" && (
        <div className="glass p-6">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              No orders match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-theme-border/50 text-neutral-400">
                    <th className="py-3 font-medium">Order ID & UTR</th>
                    <th className="py-3 font-medium">Customer</th>
                    <th className="py-3 font-medium">Product</th>
                    <th className="py-3 font-medium">Price</th>
                    <th className="py-3 font-medium">Status & Timing</th>
                    <th className="py-3 font-medium">Delivery & DM</th>
                    <th className="py-3 font-medium">Time</th>
                    <th className="py-3 text-right font-medium">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredOrders.map((order) => {
                    const isBusy = busyId === order._id;
                    const isContent = order.deliveryType === "content";
                    const hasContent = Boolean(order.deliveryContent);
                    const isExpired =
                      order.status === "expired" ||
                      (order.status === "pending" &&
                        order.expiresAt &&
                        new Date(order.expiresAt) <= new Date());
                    const displayStatus = isExpired ? "expired" : order.status;

                    return (
                      <tr key={order._id} className="transition hover:bg-white/5">
                        <td className="py-3 font-mono text-neutral-300">
                          <div>#{String(order._id).slice(-8)}</div>
                          {order.utr ? (
                            <div
                              className="mt-1 inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-300"
                              title="12-digit UPI UTR"
                            >
                              <span>UTR:</span> {order.utr}
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-600 block italic mt-0.5">
                              No UTR yet
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <p className="font-semibold text-white">{order.customerName || "Customer"}</p>
                          <p className="font-mono text-[10px] text-neutral-500">
                            {order.discordId ? `Discord: ${order.discordId}` : order.email || "No ID"}
                          </p>
                        </td>
                        <td className="py-3 text-neutral-300">
                          <p className="font-semibold text-white">
                            {order.productName || order.product?.name || "Product"}
                          </p>
                          {order.plan?.label && (
                            <span className="inline-flex items-center gap-1 mt-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-300">
                              {order.plan.label} {Number(order.plan.days) > 0 ? `(${order.plan.days}d)` : "(Lifetime)"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 font-mono font-bold text-white">
                          {formatPrice(order.price || order.amount)}
                        </td>
                        <td className="py-3">
                          <div>{renderBadge(displayStatus)}</div>
                          {order.status === "pending" && order.expiresAt && !isExpired && (
                            <span className="block mt-1 font-mono text-[10px] text-neutral-400">
                              Expires: {new Date(order.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                          {order.paidAt && (
                            <span className="block mt-1 font-mono text-[10px] text-emerald-400">
                              Paid: {new Date(order.paidAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="min-w-[190px] space-y-1.5">
                            {isContent ? (
                              hasContent ? (
                                <div className="space-y-1">
                                  <p
                                    className="max-w-[220px] truncate font-semibold text-white"
                                    title={order.deliveryContent.title}
                                  >
                                    {order.deliveryContent.title || "Delivery ready"}
                                  </p>
                                  {order.deliveryContent.message && (
                                    <p
                                      className="max-w-[220px] truncate text-[10px] text-neutral-400"
                                      title={order.deliveryContent.message}
                                    >
                                      {order.deliveryContent.message}
                                    </p>
                                  )}
                                  {order.deliveryContent.link && (
                                    <a
                                      href={order.deliveryContent.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block max-w-[220px] truncate text-[10px] text-sky-300 hover:underline"
                                    >
                                      {order.deliveryContent.buttonLabel || "Open link"}
                                    </a>
                                  )}
                                  {order.deliveryContent.stockItem && (
                                    <p
                                      className="max-w-[220px] truncate font-mono text-[10px] text-emerald-300"
                                      title={order.deliveryContent.stockItem}
                                    >
                                      Item: {order.deliveryContent.stockItem}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] italic text-neutral-500">
                                  {order.status === "processing"
                                    ? "Preparing delivery..."
                                    : "No content yet"}
                                </span>
                              )
                            ) : order.licenseKey ? (
                              <div className="flex items-center gap-1.5">
                                <code className="break-all rounded border border-theme-border bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                                  {revealedKeys[order._id]
                                    ? order.licenseKey
                                    : maskKey(order.licenseKey)}
                                </code>
                                <button
                                  onClick={() => toggleReveal(order._id)}
                                  className="shrink-0 text-[10px] font-semibold text-neutral-400 hover:text-white"
                                  title={revealedKeys[order._id] ? "Hide key" : "Reveal full key"}
                                >
                                  {revealedKeys[order._id] ? "Hide" : "Reveal"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] italic text-neutral-500">
                                {order.status === "processing" ? "Generating key..." : "No key"}
                              </span>
                            )}

                            {!isContent && order.licenseError && !order.licenseKey && (
                              <p
                                className="max-w-[220px] truncate text-[10px] text-red-400"
                                title={order.licenseError}
                              >
                                {order.licenseError}
                              </p>
                            )}

                            {isContent && order.deliveryError && !hasContent && (
                              <p
                                className="max-w-[220px] truncate text-[10px] text-red-400"
                                title={order.deliveryError}
                              >
                                {order.deliveryError}
                              </p>
                            )}

                            <div className="flex items-center gap-1.5 text-[10px]">
                              {order.dmSent ? (
                                <span className="font-semibold text-emerald-400">DM sent</span>
                              ) : (
                                <span className="font-semibold text-neutral-500">DM pending</span>
                              )}
                              {!order.dmSent && order.dmError && (
                                <span
                                  className="max-w-[120px] truncate text-red-400"
                                  title={order.dmError}
                                >
                                  {order.dmError}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px]">
                              {order.saleNotified ? (
                                <span
                                  className="font-semibold text-emerald-400"
                                  title={order.notifiedAt ? `Sale webhook sent at ${new Date(order.notifiedAt).toLocaleString()}` : "Sale webhook sent"}
                                >
                                  Webhook sent
                                </span>
                              ) : order.notifyError ? (
                                <span
                                  className="max-w-[130px] truncate font-semibold text-red-400"
                                  title={`Sale webhook error: ${order.notifyError}`}
                                >
                                  Webhook failed
                                </span>
                              ) : order.status === "completed" ? (
                                <span className="font-semibold text-neutral-500">
                                  Webhook pending
                                </span>
                              ) : null}
                            </div>

                            {(!isContent ? !order.licenseKey : !hasContent) &&
                              ["paid", "processing", "completed"].includes(order.status) && (
                                <button
                                  onClick={() => handleRetryLicense(order)}
                                  disabled={retryBusyId === order._id}
                                  className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500 hover:text-black transition disabled:opacity-50"
                                >
                                  {retryBusyId === order._id
                                    ? "Retrying..."
                                    : "Retry delivery"}
                                </button>
                              )}

                            {order.status === "completed" && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {isContent && hasContent && (
                                  <button
                                    onClick={() => openDeliveryEditor(order)}
                                    className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white hover:text-black transition"
                                  >
                                    Edit delivery
                                  </button>
                                )}
                                {(isContent ? hasContent : Boolean(order.licenseKey)) && (
                                  <button
                                    onClick={() => handleResendDM(order)}
                                    disabled={resendBusyId === order._id}
                                    className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/20 transition disabled:opacity-50"
                                  >
                                    {resendBusyId === order._id ? "Sending..." : "Resend DM"}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleResendSaleWebhook(order)}
                                  disabled={resendWebhookBusyId === order._id}
                                  className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50"
                                  title="Resend Discord New Sale webhook notification"
                                >
                                  {resendWebhookBusyId === order._id ? "Sending..." : "Resend Webhook"}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-neutral-400">{timeAgo(order.createdAt)}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {order.status !== "paid" && order.status !== "completed" && (
                              <button
                                onClick={() => updateOrderStatus(order._id, "paid")}
                                disabled={isBusy}
                                className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500 hover:text-black transition"
                                title="Confirm payment received via UPI"
                              >
                                Mark Paid
                              </button>
                            )}
                            {order.status !== "completed" &&
                              (isContent ? hasContent : Boolean(order.licenseKey)) && (
                              <button
                                onClick={() => updateOrderStatus(order._id, "completed")}
                                disabled={isBusy}
                                className="rounded border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white hover:text-black transition"
                                title="Mark order delivery completed"
                              >
                                Mark Completed
                              </button>
                            )}
                            {order.status !== "cancelled" && (
                              <button
                                onClick={() => updateOrderStatus(order._id, "cancelled")}
                                disabled={isBusy}
                                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[10px] font-medium text-neutral-400 hover:text-white transition"
                                title="Cancel order"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(order)}
                              disabled={isBusy}
                              className="rounded border border-red-500/20 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 transition"
                              title="Delete order record"
                            >
                              ✕
                            </button>
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
      )}

      {/* ── VIEW 2 & 3: PAYMENTS TABLE (ALL & UNCLAIMED) ── */}
      {(viewMode === "payments" || viewMode === "unclaimed") && (
        <div className="glass p-6">
          <div className="mb-4 flex items-center justify-between border-b border-theme-border/50 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                {viewMode === "unclaimed" ? "Unclaimed UPI Payments" : "All UPI Payments Log"}
              </h3>
              <p className="text-[11px] text-neutral-400">
                Incoming UPI credits forwarded by Google Apps Script from FamPay email alerts.
              </p>
            </div>
            <span className="font-mono text-xs text-neutral-400">
              {filteredPayments.length} record{filteredPayments.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              {viewMode === "unclaimed"
                ? "No unclaimed payments found. All received payments are matched to orders!"
                : "No UPI payment webhook records found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-theme-border/50 text-neutral-400">
                    {viewMode === "unclaimed" && (
                      <th className="w-8 py-3">
                        <input
                          type="checkbox"
                          checked={allSelectableSelected}
                          onChange={toggleSelectAllPayments}
                          disabled={selectablePayments.length === 0}
                          aria-label="Select all unclaimed payments"
                          className="h-3.5 w-3.5 accent-red-500"
                        />
                      </th>
                    )}
                    <th className="py-3 font-medium">12-Digit UTR</th>
                    <th className="py-3 font-medium">Amount</th>
                    <th className="py-3 font-medium">Payer UPI / Txn ID</th>
                    <th className="py-3 font-medium">Payment Status</th>
                    <th className="py-3 font-medium">Received Time</th>
                    <th className="py-3 text-right font-medium">Matching Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredPayments.map((p) => {
                    const isUnclaimed = p.status === "unclaimed" && !p.archived;
                    const isDeleted = p.status === "deleted" || p.archived;
                    const isMatched =
                      p.status === "matched" || p.status === "claimed";
                    const amountRupees = (Number(p.amountPaise || 0) / 100).toFixed(2);

                    return (
                      <tr key={p._id} className="transition hover:bg-white/5">
                        {viewMode === "unclaimed" && (
                          <td className="py-3.5">
                            <input
                              type="checkbox"
                              checked={selectedPaymentIds.includes(p._id)}
                              onChange={() => toggleSelectPayment(p._id)}
                              aria-label={`Select payment ${p.utr}`}
                              className="h-3.5 w-3.5 accent-red-500"
                            />
                          </td>
                        )}
                        <td className="py-3.5 font-mono font-bold text-white">
                          <span className="rounded border border-white/10 bg-black/60 px-2 py-0.5">
                            {p.utr}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-emerald-300 font-bold">
                          ₹{amountRupees}
                        </td>
                        <td className="py-3.5 text-neutral-300">
                          <div className="font-mono text-[11px]">{p.payerUpi || "FamPay Alert"}</div>
                          {p.txnId && (
                            <span className="font-mono text-[10px] text-neutral-500 block">
                              Txn: {p.txnId}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5">
                          {isDeleted ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                              deleted
                            </span>
                          ) : isUnclaimed ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                              unclaimed
                            </span>
                          ) : (
                            <span className="badge-theme px-2 py-0.5 text-[10px] font-semibold">
                              {isMatched && p.status === "matched"
                                ? "matched"
                                : "claimed"}
                            </span>
                          )}
                          {isDeleted && p.deletedAt && (
                            <span className="block mt-0.5 text-[10px] text-neutral-500">
                              {timeAgo(p.deletedAt)}
                            </span>
                          )}
                          {isDeleted && p.deleteReason && (
                            <span
                              className="block mt-0.5 max-w-[180px] truncate text-[10px] text-neutral-500"
                              title={p.deleteReason}
                            >
                              {p.deleteReason}
                            </span>
                          )}
                          {p.orderId && !isDeleted && (
                            <span className="block mt-0.5 font-mono text-[10px] text-neutral-400">
                              Order #{String(p.orderId._id || p.orderId).slice(-8)}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 text-neutral-400">
                          <div>{timeAgo(p.receivedAt || p.createdAt)}</div>
                          <span className="font-mono text-[10px] text-neutral-500 block">
                            {new Date(p.paidAt || p.receivedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          {isDeleted ? (
                            <button
                              onClick={() => handleRestorePayment(p)}
                              disabled={restoreBusyId === p._id}
                              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                              {restoreBusyId === p._id ? "Restoring..." : "Restore"}
                            </button>
                          ) : isUnclaimed ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setMatchingPayment(p);
                                  setSelectedOrderId("");
                                  setError("");
                                }}
                                className="btn-primary !px-2.5 !py-1 !text-[11px] font-bold"
                              >
                                Match with Order →
                              </button>
                              <button
                                onClick={() => openDeletePayment(p)}
                                className="rounded-md border border-red-500/50 px-2.5 py-1 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/15"
                                title="Soft-delete this unclaimed payment"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[11px] font-mono text-neutral-500">
                                Linked ✓
                              </span>
                              <button
                                type="button"
                                disabled
                                title="Only unclaimed payments can be deleted."
                                className="cursor-not-allowed rounded-md border border-red-500/20 px-2 py-1 text-[11px] font-semibold text-red-400/40"
                              >
                                Delete
                              </button>
                            </div>
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
      )}

      {/* ── VIEW 4: LEGACY WRONG-APP LICENSE REPORT ── */}
      {viewMode === "suspects" && (
        <div className="glass p-6">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-theme-border/50 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                LIB Bypass orders that may have UID-app keys
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                {suspectNote ||
                  "These completed LIB Bypass orders were created before per-product app mapping. Re-issue their keys on the LIB app manually."}
              </p>
            </div>
            <button
              onClick={handleLoadSuspects}
              disabled={suspectLoading}
              className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[11px] disabled:opacity-50"
            >
              {suspectLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {suspectLoading ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              Scanning completed orders...
            </div>
          ) : suspectError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
              {suspectError}
            </div>
          ) : suspectOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              No suspect LIB Bypass orders found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-theme-border/50 text-neutral-400">
                    <th className="py-3 font-medium">Order</th>
                    <th className="py-3 font-medium">Product / Plan</th>
                    <th className="py-3 font-medium">Discord ID</th>
                    <th className="py-3 font-medium">Current Key</th>
                    <th className="py-3 font-medium">Delivered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {suspectOrders.map((order) => (
                    <tr key={order._id} className="transition hover:bg-white/5">
                      <td className="py-3 font-mono text-neutral-300">
                        #{String(order._id).slice(-8)}
                      </td>
                      <td className="py-3">
                        <p className="font-semibold text-white">{order.productName}</p>
                        <span className="mt-0.5 inline-block rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                          {order.plan || (order.planDays ? `${order.planDays} days` : "Lifetime")}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[11px] text-neutral-400">
                        {order.discordId || "—"}
                      </td>
                      <td className="py-3">
                        <code className="break-all rounded border border-theme-border bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                          {order.licenseKey}
                        </code>
                      </td>
                      <td className="py-3 text-neutral-400">
                        {order.deliveredAt
                          ? new Date(order.deliveredAt).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL MATCH MODAL ── */}
      <AnimatePresence>
        {matchingPayment && (
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
              className="glass w-full max-w-lg p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-theme-border/50 pb-3">
                <h3 className="text-sm font-bold text-white">
                  Match Unclaimed Payment to Order
                </h3>
                <button
                  onClick={() => setMatchingPayment(null)}
                  className="text-neutral-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Payment Summary Box */}
              <div className="rounded-lg border border-theme-border bg-black/60 p-3.5 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Payment UTR:</span>
                  <span className="font-bold text-white">{matchingPayment.utr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Payment Amount:</span>
                  <span className="font-bold text-emerald-300">
                    ₹{(Number(matchingPayment.amountPaise || 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Received At:</span>
                  <span className="text-neutral-300">
                    {new Date(matchingPayment.receivedAt || matchingPayment.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Order Selection */}
              <div>
                <label className="label">Select Pending Order to Fulfill</label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="input font-mono text-xs"
                >
                  <option value="">Choose an order or paste ID below...</option>
                  {orders
                    .filter((o) => o.status === "pending" || o.status === "expired")
                    .map((o) => (
                      <option key={o._id} value={o._id}>
                        #{String(o._id).slice(-8)} — {o.productName} ({formatPrice(o.price)}) — {o.customerName || "Customer"}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="label">Or Enter Exact 24-character Order ID</label>
                <input
                  type="text"
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  placeholder="e.g. 674c1234567890abcdef1234"
                  className="input font-mono text-xs"
                />
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Matching will atomically change the payment status to <strong>claimed</strong> and the
                order status to <strong>paid</strong>, notifying the buyer immediately on their checkout page.
              </p>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-theme-border/50">
                <button
                  type="button"
                  onClick={() => setMatchingPayment(null)}
                  className="btn-ghost !py-2 !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={matchingBusy || !selectedOrderId.trim()}
                  onClick={handleConfirmMatch}
                  className="btn-primary !py-2 !text-xs font-bold"
                >
                  {matchingBusy ? "Linking Payment..." : "Confirm & Link Payment"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery Content Edit Modal */}
      <AnimatePresence>
        {deliveryEditOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.form
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onSubmit={handleSaveDelivery}
              className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-2xl"
            >
              <h3 className="text-base font-bold text-white">
                Edit delivery for this order
              </h3>
              <p className="mt-1 text-[11px] text-neutral-400">
                Order #{String(deliveryEditOrder._id).slice(-8)}. The unique stock
                item (if any) is preserved.
              </p>

              <div className="mt-5 space-y-3">
                <div>
                  <label className="label">Delivery Title</label>
                  <input
                    type="text"
                    value={deliveryForm.deliveryTitle}
                    onChange={(e) =>
                      setDeliveryForm((f) => ({
                        ...f,
                        deliveryTitle: e.target.value,
                      }))
                    }
                    className="input"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="label">Delivery Link</label>
                  <input
                    type="url"
                    value={deliveryForm.deliveryLink}
                    onChange={(e) =>
                      setDeliveryForm((f) => ({
                        ...f,
                        deliveryLink: e.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="input"
                    maxLength={2000}
                  />
                </div>
                <div>
                  <label className="label">Delivery Message</label>
                  <textarea
                    rows={5}
                    value={deliveryForm.deliveryMessage}
                    onChange={(e) =>
                      setDeliveryForm((f) => ({
                        ...f,
                        deliveryMessage: e.target.value,
                      }))
                    }
                    className="input resize-y"
                    maxLength={5000}
                  />
                </div>
                <div>
                  <label className="label">Button Label</label>
                  <input
                    type="text"
                    value={deliveryForm.deliveryButtonLabel}
                    onChange={(e) =>
                      setDeliveryForm((f) => ({
                        ...f,
                        deliveryButtonLabel: e.target.value,
                      }))
                    }
                    placeholder="Open Link"
                    className="input"
                    maxLength={80}
                  />
                </div>
                <p className="text-[10px] text-neutral-500">
                  At least a link or message is required. Links must start with
                  http:// or https://.
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-2.5 border-t border-theme-border/50 pt-3">
                <button
                  type="button"
                  onClick={() => setDeliveryEditOrder(null)}
                  className="btn-ghost !py-2 !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deliveryBusy}
                  className="btn-primary !py-2 !text-xs font-bold"
                >
                  {deliveryBusy ? "Saving..." : "Save Delivery"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
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
              className="glass w-full max-w-md p-6 shadow-2xl"
            >
              <h3 className="text-base font-bold text-white">{confirmModal.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                {confirmModal.message}
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="btn-ghost !py-2 !text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="btn-primary !py-2 !text-xs font-bold"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Payment Delete Confirmation Modal ── */}
      <AnimatePresence>
        {deleteTarget && (
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
              className="glass w-full max-w-md p-6 shadow-2xl"
            >
              <h3 className="text-base font-bold text-white">
                {deleteTarget.payments.length === 1
                  ? "Delete Unclaimed Payment?"
                  : `Delete ${deleteTarget.payments.length} Unclaimed Payments?`}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                {deleteTarget.payments.length === 1
                  ? `Delete this payment (UTR ${deleteTarget.payments[0].utr}, ₹${(
                      Number(deleteTarget.payments[0].amountPaise || 0) / 100
                    ).toFixed(2)})? It will be removed from the unclaimed list.`
                  : `Delete ${deleteTarget.payments.length} selected payments? They will be removed from the unclaimed list.`}
              </p>

              <div className="mt-4">
                <label className="label">Reason (optional)</label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Test transfer, duplicate entry, wrong UTR..."
                  className="input resize-y text-xs"
                />
              </div>

              <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                The record is kept as deleted (soft delete). You can restore it
                from “Show deleted” or use Undo for 10 seconds.
              </p>

              <div className="mt-5 flex justify-end gap-2.5 border-t border-theme-border/50 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteReason("");
                  }}
                  disabled={deleteBusy}
                  className="btn-ghost !py-2 !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeletePayments}
                  disabled={deleteBusy}
                  className="rounded-md border border-red-500/50 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
                >
                  {deleteBusy ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Undo delete toast (10s) ── */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-4 rounded-xl border border-theme-border bg-neutral-950 px-4 py-3 text-xs text-white shadow-2xl"
          >
            <span>{undoToast.label}</span>
            <button
              type="button"
              onClick={handleUndoDelete}
              disabled={undoBusy}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {undoBusy ? "Restoring..." : "Undo"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
