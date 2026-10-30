"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS = [
  { key: "users", label: "Total Users" },
  { key: "orders", label: "Total Orders" },
  { key: "clients", label: "Total Clients" },
];

export default function StatsManager({ cached = {}, real = {} }) {
  const router = useRouter();
  const [form, setForm] = useState({
    users: String(cached.users ?? 0),
    orders: String(cached.orders ?? 0),
    clients: String(cached.clients ?? 0),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (payload) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      setMessage("Stats updated — live counters synchronized successfully.");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    save({
      users: Number(form.users),
      orders: Number(form.orders),
      clients: Number(form.clients),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Live Store Statistics</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Sync or manually override the public counter numbers displayed on the landing page.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="glass p-6 space-y-6">
        <div className="grid gap-6 sm:grid-cols-3">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="label" htmlFor={`stat-${field.key}`}>
                {field.label}
              </label>
              <input
                id={`stat-${field.key}`}
                type="number"
                min="0"
                className="input"
                value={form[field.key]}
                onChange={set(field.key)}
              />
              <p className="text-[11px] text-neutral-500">
                Database count: <strong className="font-mono text-white">{real[field.key] ?? 0}</strong>
                {(form[field.key] === "" ? cached[field.key] : Number(form[field.key])) !==
                real[field.key] ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => save({ [field.key]: real[field.key] })}
                    className="ml-2 font-semibold underline hover:text-white"
                    style={{ color: "var(--accent-primary)" }}
                  >
                    sync to real
                  </button>
                ) : (
                  <span className="ml-2 text-emerald-400 font-medium">✓ synced</span>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-theme-border/50 pt-4">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              save({
                users: real.users ?? 0,
                orders: real.orders ?? 0,
                clients: real.clients ?? 0,
              })
            }
            className="btn-ghost !text-xs"
          >
            Sync All to Real MongoDB Counts
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary !text-xs font-bold"
          >
            {saving ? "Saving Changes..." : "Save Overrides"}
          </button>
        </div>
      </form>
    </div>
  );
}
