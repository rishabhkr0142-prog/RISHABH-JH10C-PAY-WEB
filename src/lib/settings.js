import connectDB from "@/lib/db";
import Settings from "@/models/Settings";
import { maskWebhookUrl } from "@/lib/discord-sale-webhook";

const DEFAULT_SETTINGS = {
  site_name: "RISHABH JH10C PAY WEB",
  support_email:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.replace(/[\[\]]/g, "") ||
    "support@jh10c.com",
  discord_invite:
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/tvw2zFMyzA",
  order_cooldown_minutes: Number(process.env.ORDER_COOLDOWN_MINUTES || 10),
  default_theme: "mono",
  sales_webhook_url: "",
  sales_webhook_enabled: false,
  sales_webhook_show_customer: true,
  sales_webhook_show_image: true,
  sales_webhook_show_button: true,
  alerts_webhook_url: "",
  alerts_webhook_enabled: false,
};

/**
 * Retrieve all settings as a plain key-value object with fallback defaults.
 */
export async function getAllSettings() {
  try {
    await connectDB();
    const docs = await Settings.find().lean();
    const map = { ...DEFAULT_SETTINGS };
    for (const doc of docs) {
      if (doc.key) {
        map[doc.key] = doc.value;
      }
    }
    return map;
  } catch (err) {
    console.error("Failed to read settings from DB:", err?.message || err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Get a single setting by key.
 */
export async function getSetting(key, fallback = null) {
  try {
    await connectDB();
    const doc = await Settings.findOne({ key }).lean();
    if (doc && doc.value !== undefined) return doc.value;
    return DEFAULT_SETTINGS[key] ?? fallback;
  } catch (err) {
    console.error(`Failed to read setting ${key}:`, err?.message || err);
    return DEFAULT_SETTINGS[key] ?? fallback;
  }
}

/**
 * Set a single setting by key.
 */
export async function setSetting(key, value) {
  await connectDB();
  return Settings.findOneAndUpdate(
    { key },
    { key, value },
    { upsert: true, new: true }
  );
}

/**
 * Return settings for the admin panel with sensitive webhook URLs masked.
 * Full URLs are NEVER sent to the client browser.
 */
export async function getSafeAdminSettings() {
  const all = await getAllSettings();
  const safe = { ...all };

  safe.has_sales_webhook = Boolean(all.sales_webhook_url);
  safe.sales_webhook_url_masked = all.sales_webhook_url
    ? maskWebhookUrl(all.sales_webhook_url)
    : "";
  delete safe.sales_webhook_url;

  safe.has_alerts_webhook = Boolean(all.alerts_webhook_url);
  safe.alerts_webhook_url_masked = all.alerts_webhook_url
    ? maskWebhookUrl(all.alerts_webhook_url)
    : "";
  delete safe.alerts_webhook_url;

  return safe;
}
