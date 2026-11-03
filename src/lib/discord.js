/**
 * Server-only Discord REST helpers.
 *
 * We deliberately use plain REST `fetch` calls instead of a gateway client.
 * The same bot token is already connected to the auth panel's gateway, so a
 * second `new Client().login()` here would disconnect that session.
 *
 * DISCORD_BOT_TOKEN is never logged or sent to the browser.
 */

import { productLabel } from "@/lib/product-keys";
import { isContentDelivery } from "@/lib/delivery-content";

const DISCORD_API = "https://discord.com/api/v10";
const REQUEST_TIMEOUT_MS = 15000;

function getBotToken() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is not configured on the server.");
  }
  return token;
}

async function discordRequest(path, { method = "GET", body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${DISCORD_API}${path}`, {
      method,
      headers: {
        Authorization: `Bot ${getBotToken()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    const reason = err?.name === "AbortError" ? "request timed out" : "network error";
    throw new Error(`Discord API ${reason}.`);
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text().catch(() => "");
  let payload = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    const apiMessage =
      payload && typeof payload === "object"
        ? payload.message || payload.error || ""
        : "";
    throw new Error(
      `Discord API failed (HTTP ${response.status})${apiMessage ? `: ${String(apiMessage).slice(0, 160)}` : ""}`
    );
  }

  return payload;
}

/** Open (or reuse) a DM channel with a user. */
export async function openDMChannel(discordId) {
  const recipientId = String(discordId || "").trim();
  if (!/^\d{17,20}$/.test(recipientId)) {
    throw new Error("Invalid Discord user ID for DM delivery.");
  }

  const channel = await discordRequest("/users/@me/channels", {
    method: "POST",
    body: { recipient_id: recipientId },
  });

  const channelId = channel?.id ? String(channel.id) : "";
  if (!channelId) {
    throw new Error("Discord did not return a DM channel.");
  }

  return channelId;
}

function planLabel(order) {
  const label = order?.plan?.label;
  if (label) return String(label);
  const days = Number(order?.plan?.days) || 0;
  return days > 0 ? `${days} Days` : "Lifetime";
}

function expiryLabel(order) {
  const days = Number(order?.plan?.days) || 0;
  if (!days) return "Lifetime (no expiry)";
  const base = order?.deliveredAt || order?.paidAt || new Date();
  const date = new Date(base);
  if (isNaN(date.getTime())) return `${days} Days`;
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function truncate(value, max) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function linkMarkdown(label, url) {
  const safeLabel = String(label || "Open Link").replace(/[[\]]/g, "").trim();
  return `[${safeLabel || "Open Link"}](${url})`;
}

/**
 * Send a completed order to the buyer via Discord DM.
 * License orders receive their key; content orders receive their snapshot.
 *
 * @param {{ discordId: string, order: object }} params
 * @returns {Promise<{ channelId: string, messageId: string }>}
 */
export async function sendOrderDM({ discordId, order }) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is not configured on the server.");
  }

  const isContent = isContentDelivery(order?.deliveryType);
  const licenseKey = String(order?.licenseKey || "").trim();
  const delivery = order?.deliveryContent || null;

  if (isContent && !delivery) {
    throw new Error("Order does not have delivery content yet.");
  }
  if (!isContent && !licenseKey) {
    throw new Error("Order does not have a license key yet.");
  }

  const channelId = await openDMChannel(discordId);

  const loaderUrl = String(process.env.LOADER_URL || "").trim();
  const supportUrl =
    String(process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "").trim() ||
    "https://discord.gg/tvw2zFMyzA";

  const productName =
    order?.productName ||
    productLabel(order?.productKey) ||
    "Digital Product";
  const plan = planLabel(order);

  const fields = [
    {
      name: "Product",
      value: productName,
      inline: false,
    },
    {
      name: "Plan",
      value: plan,
      inline: true,
    },
  ];

  if (isContent) {
    const title = String(delivery?.title || "Delivery Details").trim();
    const message = String(delivery?.message || "").trim();
    const link = String(delivery?.link || "").trim();
    const stockItem = String(delivery?.stockItem || "").trim();

    if (message) {
      fields.push({
        name: truncate(title || "Delivery Details", 256),
        value: truncate(message, 1024),
        inline: false,
      });
    } else if (title) {
      fields.push({
        name: "Delivery",
        value: truncate(title, 1024),
        inline: false,
      });
    }

    if (link) {
      fields.push({
        name: "Link",
        value: linkMarkdown(delivery?.buttonLabel, link),
        inline: false,
      });
    }

    if (stockItem) {
      fields.push({
        name: "Your Item",
        value: `\`\`\`\n${truncate(stockItem, 1000)}\n\`\`\``,
        inline: false,
      });
    }

    fields.push({
      name: "Important",
      value: "Keep these delivery details private. Do not share them publicly.",
      inline: false,
    });
  } else {
    fields.push(
      {
        name: "License Key",
        value: `\`\`\`\n${licenseKey}\n\`\`\``,
        inline: false,
      },
      {
        name: "Validity",
        value: expiryLabel(order),
        inline: true,
      },
      {
        name: "Devices",
        value: "1 device only",
        inline: true,
      }
    );

    if (loaderUrl) {
      fields.push({
        name: "Loader",
        value: `[Download Loader](${loaderUrl})`,
        inline: false,
      });
    }

    fields.push({
      name: "Important",
      value: "Ye key sirf 1 device ke liye hai. HWID reset nahi hoga.",
      inline: false,
    });
  }

  const siteUrl = String(
    process.env.SITE_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://rishabh-jh10c-pay-web.antideploy.app"
  ).replace(/\/$/, "");
  const logoIconUrl = `${siteUrl}/logo-icon.png`;

  const embed = {
    title: "Payment Verified",
    description: `Order #${String(order?._id || "").slice(-8)} has been fulfilled.`,
    color: 0x22c55e,
    thumbnail: {
      url: logoIconUrl,
    },
    fields,
    footer: {
      text: `RISHABH JH10C PAY WEB · Need help? ${supportUrl}`,
      icon_url: logoIconUrl,
    },
    timestamp: new Date().toISOString(),
  };

  const message = await discordRequest(`/channels/${channelId}/messages`, {
    method: "POST",
    body: {
      content: isContent
        ? `<@${String(discordId)}> your delivery details are ready!`
        : `<@${String(discordId)}> your license key is ready!`,
      embeds: [embed],
      allowed_mentions: { parse: [], users: [String(discordId)] },
    },
  });

  return {
    channelId,
    messageId: message?.id ? String(message.id) : "",
  };
}

/** Backward-compatible alias for older imports. */
export const sendLicenseDM = sendOrderDM;

export default sendOrderDM;
