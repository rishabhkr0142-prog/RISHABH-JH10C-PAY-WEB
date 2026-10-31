"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import OfferForm from "./OfferForm";
import {
  getOfferStatus,
  formatRemaining,
  formatDateTime,
} from "@/lib/offer-utils";

const STATUS_STYLES = {
  live: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
  scheduled: "border-amber-500/30 bg-amber-950/40 text-amber-300",
  expired: "border-neutral-700 bg-neutral-900 text-neutral-400",
  paused: "border-neutral-700 bg-neutral-900 text-neutral-400",
};

const STATUS_LABELS = {
  live: "Live",
  scheduled: "Scheduled",
  expired: "Closed",
  paused: "Paused",
};

export default function OffersManager({ offers = [], products = [] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleToggleActive = async (offer) => {
    setBusyId(offer._id);
    setError("");
    const newStatus = !offer.active;
    try {
      const res = await fetch(`/api/admin/offers/${offer._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      setToast({
        type: "success",
        message: `Offer ${newStatus ? "activated" : "paused"}.`,
      });
      router.refresh();
    } catch (err) {
      const msg = err.message || "Failed to update offer.";
      setError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (offer) => {
    setConfirmModal({
      title: `Permanently Delete "${offer.title}"?`,
      message:
        "This deletes the offer from the MongoDB database and it will stop showing on the website immediately. This action cannot be undone.",
      onConfirm: async () => {
        setConfirmModal(null);
        setBusyId(offer._id);
        setError("");
        try {
          const res = await fetch(`/api/admin/offers/${offer._id}`, {
            method: "DELETE",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Failed to delete offer");
          setToast({ type: "success", message: `"${offer.title}" deleted.` });
          router.refresh();
        } catch (err) {
          const msg = err.message || "Failed to delete offer.";
          setError(msg);
          setToast({ type: "error", message: msg });
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  return (
    <div className="space-y-6 relative">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            className={`fixed top-20 right-6 z-50 flex max-w-md items-center gap-3 rounded-xl border p-4 shadow-2xl backdrop-blur-md text-xs font-semibold ${
              toast.type === "success"
                ? "border-emerald-500/40 bg-[#06150b]/95 text-emerald-300"
                : "border-red-500/40 bg-[#160505]/95 text-red-300"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                toast.type === "success"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {toast.type === "success" ? "✓" : "!"}
            </span>
            <span className="flex-1 leading-relaxed">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-neutral-400 hover:text-white transition"
              title="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Time-Limited Offers</h2>
          <p className="mt-1 text-xs text-neutral-400">
            {offers.length} offer{offers.length === 1 ? "" : "s"} in MongoDB. Expired offers close
            for clients automatically; only you can edit or re-open them.
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="btn-primary !text-xs font-semibold"
        >
          + Add New Offer
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {offers.length === 0 ? (
        <div className="glass p-12 text-center text-neutral-400">
          <p className="text-xs">No offers created yet.</p>
          <button
            onClick={() => setEditing("new")}
            className="btn-primary mt-4 !text-xs"
          >
            Create Your First Offer
          </button>
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme-border/50 text-neutral-400">
                  <th className="p-4 font-medium">Offer</th>
                  <th className="p-4 font-medium">Discount</th>
                  <th className="p-4 font-medium">Window</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {offers.map((offer) => {
                  const status = getOfferStatus(offer, now);
                  const isBusy = busyId === offer._id;
                  const remaining = offer.endsAt
                    ? new Date(offer.endsAt).getTime() - now
                    : 0;

                  return (
                    <tr key={offer._id} className="transition hover:bg-white/5">
                      <td className="p-4">
                        <p className="font-semibold text-white">{offer.title}</p>
                        {offer.productName && (
                          <p className="mt-0.5 text-[10px] text-neutral-400">
                            Product: {offer.productName}
                          </p>
                        )}
                        {offer.couponCode && (
                          <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
                            Code: {offer.couponCode}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        {offer.discountLabel ? (
                          <span className="badge-theme px-2 py-0.5 text-[10px] font-semibold">
                            {offer.discountLabel}
                          </span>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="p-4 text-neutral-300">
                        <p className="whitespace-nowrap text-[11px]">
                          {formatDateTime(offer.startsAt)}
                        </p>
                        <p className="whitespace-nowrap text-[11px] text-neutral-500">
                          → {formatDateTime(offer.endsAt)}
                        </p>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status]}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {STATUS_LABELS[status]}
                        </span>
                        {status === "live" && (
                          <p className="mt-1 font-mono text-[10px] text-emerald-300">
                            {formatRemaining(remaining)}
                          </p>
                        )}
                        {status === "scheduled" && offer.startsAt && (
                          <p className="mt-1 text-[10px] text-amber-300">
                            Starts in {formatRemaining(new Date(offer.startsAt).getTime() - now)}
                          </p>
                        )}
                        {status === "expired" && (
                          <p className="mt-1 text-[10px] text-neutral-500">
                            Closed for clients
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleActive(offer)}
                            disabled={isBusy}
                            className="rounded border border-theme-border px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:bg-white/10 hover:text-white"
                          >
                            {offer.active ? "Pause" : "Activate"}
                          </button>
                          <button
                            onClick={() => setEditing(offer)}
                            disabled={isBusy}
                            className="rounded border border-theme-border px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:bg-white/10 hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(offer)}
                            disabled={isBusy}
                            className="rounded border border-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <OfferForm
            offer={editing === "new" ? null : editing}
            products={products}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

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
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
