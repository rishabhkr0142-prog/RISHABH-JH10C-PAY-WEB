"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

export default function SettingsManager({ initialSettings = {} }) {
  const router = useRouter();
  const { setTheme, themes } = useTheme();

  const [form, setForm] = useState({
    site_name: initialSettings.site_name || "RISHABH JH10C PAY WEB",
    support_email: initialSettings.support_email || "support@jh10c.com",
    discord_invite: initialSettings.discord_invite || "https://discord.gg/tvw2zFMyzA",
    order_cooldown_minutes: initialSettings.order_cooldown_minutes ?? 10,
    default_theme: initialSettings.default_theme || "mono",
  });

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      // Apply the theme immediately
      setTheme(form.default_theme);

      setToast({ type: "success", text: "Settings saved and theme applied successfully!" });
      router.refresh();
    } catch (err) {
      setToast({ type: "error", text: err.message || "Something went wrong." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Store & Anti-Spam Configuration</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Configure default visual theme, global store parameters, anti-spam limits, and contact links.
        </p>
      </div>

      {toast && (
        <div
          className={`rounded-lg border p-3 text-xs font-medium ${
            toast.type === "success"
              ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
              : "border-red-500/30 bg-red-950/40 text-red-300"
          }`}
        >
          {toast.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass p-6 space-y-5">
        {/* Default Theme Selector (5 Multi-Color Designs from UI/UX Pro Max) */}
        <div>
          <label className="label">
            Store Design & Color Theme Preset
          </label>
          <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {themes.map((t) => {
              const isSelected = form.default_theme === t.id;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => {
                    setForm({ ...form, default_theme: t.id });
                    setTheme(t.id);
                  }}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? "border-white bg-white/10 shadow-sm"
                      : "border-theme-border bg-theme-surface hover:border-theme-border-hover"
                  }`}
                >
                  <div className="flex items-center -space-x-1">
                    <span
                      className="h-4 w-4 rounded-full border border-black/60 shadow-sm"
                      style={{ backgroundColor: t.primary }}
                    />
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-black/60 shadow-sm opacity-90"
                      style={{ backgroundColor: t.secondary }}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white">{t.name}</p>
                    <p className="text-[10px] text-neutral-400">{t.tagline}</p>
                  </div>
                  {isSelected && <span className="font-mono text-xs text-white">✓</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-neutral-500 leading-relaxed">
            Powered by UI/UX Pro Max architecture. Users can also toggle themes live using the navbar or floating widget.
          </p>
        </div>

        {/* Order Cooldown (minutes) */}
        <div>
          <label className="label">
            Order Cooldown (Minutes) <span className="text-white">*</span>
          </label>
          <input
            type="number"
            min="0"
            max="1440"
            value={form.order_cooldown_minutes}
            onChange={(e) =>
              setForm({ ...form, order_cooldown_minutes: Number(e.target.value) })
            }
            className="input"
            required
          />
          <p className="mt-1.5 text-[11px] text-neutral-500 leading-relaxed">
            Minimum waiting period between consecutive orders from standard Discord users. Set to
            0 to disable. (Admins are always exempt). Default is 10 minutes.
          </p>
        </div>

        {/* Site Name */}
        <div>
          <label className="label">Site Name</label>
          <input
            type="text"
            value={form.site_name}
            onChange={(e) => setForm({ ...form, site_name: e.target.value })}
            className="input"
            required
          />
        </div>

        {/* Support Email */}
        <div>
          <label className="label">Support Email Address</label>
          <input
            type="email"
            value={form.support_email}
            onChange={(e) => setForm({ ...form, support_email: e.target.value })}
            className="input"
            required
          />
        </div>

        {/* Discord Invite URL */}
        <div>
          <label className="label">Discord Server Invite URL</label>
          <input
            type="url"
            value={form.discord_invite}
            onChange={(e) => setForm({ ...form, discord_invite: e.target.value })}
            className="input"
            required
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-2.5 text-xs font-bold sm:w-auto"
          >
            {saving ? "Saving Changes..." : "Save Store Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
