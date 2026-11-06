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

    // Sales Webhook
    sales_webhook_enabled: Boolean(initialSettings.sales_webhook_enabled),
    sales_webhook_show_customer: initialSettings.sales_webhook_show_customer ?? true,
    sales_webhook_show_image: initialSettings.sales_webhook_show_image ?? true,
    sales_webhook_show_button: initialSettings.sales_webhook_show_button ?? true,

    // Alerts Webhook
    alerts_webhook_enabled: Boolean(initialSettings.alerts_webhook_enabled),
  });

  // Webhook URL inputs (raw user input for replacing or adding)
  const [salesWebhookInput, setSalesWebhookInput] = useState("");
  const [alertsWebhookInput, setAlertsWebhookInput] = useState("");
  const [showSalesInputPassword, setShowSalesInputPassword] = useState(false);
  const [showAlertsInputPassword, setShowAlertsInputPassword] = useState(false);

  // Masked representations received from server
  const [salesMasked, setSalesMasked] = useState(initialSettings.sales_webhook_url_masked || "");
  const [hasSalesWebhook, setHasSalesWebhook] = useState(Boolean(initialSettings.has_sales_webhook));

  const [alertsMasked, setAlertsMasked] = useState(initialSettings.alerts_webhook_url_masked || "");
  const [hasAlertsWebhook, setHasAlertsWebhook] = useState(Boolean(initialSettings.has_alerts_webhook));

  // Test states & feedback
  const [testingSales, setTestingSales] = useState(false);
  const [salesTestResult, setSalesTestResult] = useState(null);

  const [testingAlerts, setTestingAlerts] = useState(false);
  const [alertsTestResult, setAlertsTestResult] = useState(null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const handleTestWebhook = async (type) => {
    if (type === "sales") {
      setTestingSales(true);
      setSalesTestResult(null);
    } else {
      setTestingAlerts(true);
      setAlertsTestResult(null);
    }

    try {
      const urlToSend = type === "sales" ? salesWebhookInput : alertsWebhookInput;
      const res = await fetch("/api/admin/settings/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          url: urlToSend || undefined,
          showCustomer: form.sales_webhook_show_customer,
          showImage: form.sales_webhook_show_image,
          showButton: form.sales_webhook_show_button,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to deliver test webhook.");
      }

      const resultObj = { type: "success", text: data.message || "Test webhook sent successfully!" };
      if (type === "sales") setSalesTestResult(resultObj);
      else setAlertsTestResult(resultObj);
    } catch (err) {
      const resultObj = { type: "error", text: err.message || "Webhook delivery failed." };
      if (type === "sales") setSalesTestResult(resultObj);
      else setAlertsTestResult(resultObj);
    } finally {
      if (type === "sales") setTestingSales(false);
      else setTestingAlerts(false);
    }
  };

  const handleRemoveWebhook = (type) => {
    if (type === "sales") {
      setSalesWebhookInput("");
      setSalesMasked("");
      setHasSalesWebhook(false);
      setForm((prev) => ({ ...prev, sales_webhook_enabled: false }));
    } else {
      setAlertsWebhookInput("");
      setAlertsMasked("");
      setHasAlertsWebhook(false);
      setForm((prev) => ({ ...prev, alerts_webhook_enabled: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setToast(null);

    try {
      const payload = {
        ...form,
      };

      // Only include webhook URL if user typed a new one, or cleared it
      if (salesWebhookInput.trim()) {
        payload.sales_webhook_url = salesWebhookInput.trim();
      } else if (!hasSalesWebhook) {
        payload.sales_webhook_url = "";
      }

      if (alertsWebhookInput.trim()) {
        payload.alerts_webhook_url = alertsWebhookInput.trim();
      } else if (!hasAlertsWebhook) {
        payload.alerts_webhook_url = "";
      }

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      // Apply the theme immediately
      setTheme(form.default_theme);

      // Update masked values from response
      if (data?.settings) {
        setSalesMasked(data.settings.sales_webhook_url_masked || "");
        setHasSalesWebhook(Boolean(data.settings.has_sales_webhook));
        setSalesWebhookInput("");

        setAlertsMasked(data.settings.alerts_webhook_url_masked || "");
        setHasAlertsWebhook(Boolean(data.settings.has_alerts_webhook));
        setAlertsWebhookInput("");
      }

      setToast({ type: "success", text: "Settings and webhooks saved successfully!" });
      router.refresh();
    } catch (err) {
      setToast({ type: "error", text: err.message || "Something went wrong." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8 pb-16">
      <div>
        <h2 className="text-xl font-bold text-white">Store &amp; Notification Configuration</h2>
        <p className="mt-1 text-xs text-neutral-400">
          Configure live Discord webhooks, global store parameters, anti-spam limits, and theme presets.
        </p>
      </div>

      {toast && (
        <div
          className={`rounded-xl border p-4 text-xs font-semibold shadow-lg ${
            toast.type === "success"
              ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
              : "border-red-500/30 bg-red-950/40 text-red-300"
          }`}
        >
          {toast.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── 1. NOTIFICATIONS & DISCORD WEBHOOKS SECTION ── */}
        <div className="glass p-6 space-y-6 border border-amber-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Discord Sales Webhook (Components V2)
                </h3>
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Automatically posts a notification in your Discord channel whenever an order completes.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.sales_webhook_enabled}
                onChange={(e) =>
                  setForm({ ...form, sales_webhook_enabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              <span className="ml-2 text-xs font-semibold text-neutral-300">
                {form.sales_webhook_enabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>

          {/* Webhook URL Input & Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label">
                Sales Channel Webhook URL
              </label>
              {hasSalesWebhook && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                  ✓ Configured
                </span>
              )}
            </div>

            {hasSalesWebhook && (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/50 p-2.5 text-xs">
                <div className="flex items-center gap-2 font-mono text-neutral-300 truncate">
                  <span className="text-neutral-500">Active URL:</span>
                  <span className="text-emerald-400 truncate">{salesMasked}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveWebhook("sales")}
                  className="ml-3 rounded border border-red-500/20 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 transition shrink-0"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="relative">
              <input
                type={showSalesInputPassword ? "text" : "password"}
                value={salesWebhookInput}
                onChange={(e) => setSalesWebhookInput(e.target.value)}
                placeholder={
                  hasSalesWebhook
                    ? "Enter new Discord webhook URL to replace current one..."
                    : "https://discord.com/api/webhooks/1234567890/token..."
                }
                className="input pr-20 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowSalesInputPassword(!showSalesInputPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-neutral-400 hover:text-white transition"
              >
                {showSalesInputPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">
              In Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.
              Full URLs are stored securely in the database and never shown back to browsers.
            </p>
          </div>

          {/* Optional Display Toggles */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Notification Content Customization
            </h4>

            <div className="grid gap-3 sm:grid-cols-3">
              {/* Toggle Customer Name */}
              <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sales_webhook_show_customer}
                  onChange={(e) =>
                    setForm({ ...form, sales_webhook_show_customer: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-0"
                />
                <span>Masked Customer (<code className="text-white text-[11px]">ri••••••c</code>)</span>
              </label>

              {/* Toggle Product Image */}
              <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sales_webhook_show_image}
                  onChange={(e) =>
                    setForm({ ...form, sales_webhook_show_image: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-0"
                />
                <span>Product Thumbnail Image</span>
              </label>

              {/* Toggle View Product Button */}
              <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sales_webhook_show_button}
                  onChange={(e) =>
                    setForm({ ...form, sales_webhook_show_button: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-0"
                />
                <span>&ldquo;View Product&rdquo; Link Button</span>
              </label>
            </div>
          </div>

          {/* Test Sales Webhook Button & Feedback */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleTestWebhook("sales")}
              disabled={testingSales || (!hasSalesWebhook && !salesWebhookInput.trim())}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-300 transition disabled:opacity-40"
            >
              {testingSales ? "Sending Test to Discord..." : "🧪 Send Test Sale Notification"}
            </button>
            <span className="text-[11px] text-neutral-500">
              Sends an immediate test sale message to verify Discord integration.
            </span>
          </div>

          {salesTestResult && (
            <div
              className={`rounded-lg border p-3 text-xs font-semibold ${
                salesTestResult.type === "success"
                  ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                  : "border-red-500/40 bg-red-950/40 text-red-300"
              }`}
            >
              {salesTestResult.text}
            </div>
          )}

          {/* ── Optional Second Webhook: Admin Alerts ── */}
          <div className="border-t border-white/10 pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Secondary Admin Alerts Webhook (Optional)
                </h4>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  Sends low inventory alerts, failed key delivery notices, and unclaimed payment notifications to a private staff channel.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.alerts_webhook_enabled}
                  onChange={(e) =>
                    setForm({ ...form, alerts_webhook_enabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                <span className="ml-2 text-xs font-semibold text-neutral-300">
                  {form.alerts_webhook_enabled ? "Enabled" : "Disabled"}
                </span>
              </label>
            </div>

            {hasAlertsWebhook && (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/50 p-2.5 text-xs">
                <div className="flex items-center gap-2 font-mono text-neutral-300 truncate">
                  <span className="text-neutral-500">Active URL:</span>
                  <span className="text-indigo-400 truncate">{alertsMasked}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveWebhook("alerts")}
                  className="ml-3 rounded border border-red-500/20 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 transition shrink-0"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="relative">
              <input
                type={showAlertsInputPassword ? "text" : "password"}
                value={alertsWebhookInput}
                onChange={(e) => setAlertsWebhookInput(e.target.value)}
                placeholder={
                  hasAlertsWebhook
                    ? "Enter new Alerts Webhook URL to replace..."
                    : "https://discord.com/api/webhooks/1234567890/token..."
                }
                className="input pr-20 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowAlertsInputPassword(!showAlertsInputPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-neutral-400 hover:text-white transition"
              >
                {showAlertsInputPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleTestWebhook("alerts")}
                disabled={testingAlerts || (!hasAlertsWebhook && !alertsWebhookInput.trim())}
                className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-3.5 py-2 text-xs font-bold text-indigo-300 transition disabled:opacity-40"
              >
                {testingAlerts ? "Sending Test..." : "🧪 Send Test Admin Alert"}
              </button>
            </div>

            {alertsTestResult && (
              <div
                className={`rounded-lg border p-3 text-xs font-semibold ${
                  alertsTestResult.type === "success"
                    ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                    : "border-red-500/40 bg-red-950/40 text-red-300"
                }`}
              >
                {alertsTestResult.text}
              </div>
            )}
          </div>
        </div>

        {/* ── 2. STORE APPEARANCE & ANTI-SPAM SETTINGS ── */}
        <div className="glass p-6 space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/10 pb-3">
            General Store &amp; Anti-Spam Settings
          </h3>

          {/* Theme Selector */}
          <div>
            <label className="label">
              Store Design &amp; Color Theme Preset
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
          </div>

          {/* Order Cooldown */}
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
              0 to disable. (Admins are always exempt).
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
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-3 text-xs font-bold shadow-lg"
          >
            {saving ? "Saving All Settings..." : "Save Store & Webhook Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
