"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { formatPrice, timeAgo } from "@/lib/format";

export default function ClientsManager({ clients = [] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [confirmModal, setConfirmModal] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    discordId: "",
    totalSpent: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not add client");
      }
      setForm({ name: "", email: "", discordId: "", totalSpent: "", notes: "" });
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (client) => {
    setConfirmModal({
      title: `Remove client "${client.name}"?`,
      message: "This will remove the client record and decrement the client count. This action cannot be undone.",
      onConfirm: async () => {
        setConfirmModal(null);
        setBusyId(client._id);
        setError("");
        try {
          const res = await fetch(`/api/admin/clients/${client._id}`, {
            method: "DELETE",
          });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Verified Clients</h2>
          <p className="mt-1 text-xs text-neutral-400">
            {clients.length} client{clients.length === 1 ? "" : "s"} with verified customer standing
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary !text-xs font-semibold"
        >
          {showForm ? "Cancel" : "+ Add Client Record"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="glass p-6 space-y-4"
          >
            <h3 className="text-sm font-bold text-white">Create Client Record</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Client Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={set("name")}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email</label>
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
                <label className="label">Total Spent</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.totalSpent}
                  onChange={set("totalSpent")}
                  placeholder="0"
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={set("notes")}
                className="input resize-none"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary !text-xs"
              >
                {saving ? "Saving..." : "Save Client"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Table */}
      {clients.length === 0 ? (
        <div className="glass p-12 text-center text-xs text-neutral-500">
          No clients recorded yet. Add your first client above.
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme-border/50 text-neutral-400">
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Discord ID</th>
                  <th className="p-4 font-medium">Total Spent</th>
                  <th className="p-4 font-medium">Notes</th>
                  <th className="p-4 font-medium">Added</th>
                  <th className="p-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clients.map((client) => (
                  <tr key={client._id} className="transition hover:bg-white/5">
                    <td className="p-4 font-semibold text-white">
                      {client.name}
                      {client.email && (
                        <span className="block text-[11px] font-normal text-neutral-400">
                          {client.email}
                        </span>
                      )}
                    </td>
                    <td
                      className="p-4 font-mono font-medium"
                      style={{ color: "var(--accent-primary)" }}
                    >
                      {client.discordId || "—"}
                    </td>
                    <td className="p-4 font-mono font-bold text-white">
                      {formatPrice(client.totalSpent || 0)}
                    </td>
                    <td className="p-4 text-neutral-400">
                      {client.notes || "—"}
                    </td>
                    <td className="p-4 text-neutral-500">
                      {timeAgo(client.createdAt)}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(client)}
                        disabled={busyId === client._id}
                        className="rounded border border-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
