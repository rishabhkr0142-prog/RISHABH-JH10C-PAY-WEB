import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { getSetting } from "@/lib/settings";

const REQUEST_TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;

/**
 * Validate a Discord webhook URL.
 * SSRF defense: only allows official Discord HTTPS webhook domains and paths.
 */
export function isValidDiscordWebhookUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;

    const validHosts = [
      "discord.com",
      "discordapp.com",
      "canary.discord.com",
      "ptb.discord.com",
    ];
    if (!validHosts.includes(parsed.hostname.toLowerCase())) return false;

    const parts = parsed.pathname.split("/").filter(Boolean);
    // Path must follow: /api/webhooks/<snowflake_id>/<webhook_token>
    if (parts.length < 4 || parts[0] !== "api" || parts[1] !== "webhooks") {
      return false;
    }

    const webhookId = parts[2];
    const webhookToken = parts[3];

    // Discord snowflake: 17 to 21 numeric digits
    if (!/^\d{17,21}$/.test(webhookId)) return false;
    // Webhook token: alphanumeric with hyphens / underscores
    if (!/^[a-zA-Z0-9_-]{20,}$/.test(webhookToken)) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Mask a Discord webhook URL for safe display in the admin panel.
 * Never send the full webhook token to the frontend.
 * Example: https://discord.com/api/webhooks/1234...89/abcd...****
 */
export function maskWebhookUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url.trim());
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 4) {
      const id = parts[2];
      const token = parts[3];
      const maskedId = id.length > 6 ? `${id.slice(0, 4)}...${id.slice(-2)}` : `${id.slice(0, 2)}...`;
      const maskedToken = token.length > 6 ? `${token.slice(0, 4)}...****` : "****";
      return `https://${parsed.hostname}/api/webhooks/${maskedId}/${maskedToken}`;
    }
  } catch {}
  return "https://discord.com/api/webhooks/****";
}

/**
 * Escape Discord markdown formatting characters in user-controlled strings.
 */
export function escapeDiscordMarkdown(text) {
  if (!text) return "";
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~")
    .replace(/`/g, "\\`")
    .replace(/>/g, "\\>")
    .replace(/\|/g, "\\|")
    .replace(/@/g, "@\u200B") // Prevent role / everyone pings
    .replace(/#/g, "#\u200B");
}

/**
 * Mask customer name for privacy in Discord channels.
 * e.g. "rishabh10c" -> "ri••••••c"
 * e.g. "sam" -> "s•••m"
 * e.g. "al" -> "a•••"
 */
export function maskCustomerName(rawName) {
  const clean = String(rawName || "Customer").trim();
  if (!clean || clean.toLowerCase() === "guest" || clean.toLowerCase() === "customer") {
    return "Customer";
  }

  if (clean.length <= 2) {
    return `${clean[0]}•••`;
  }

  if (clean.length <= 4) {
    return `${clean[0]}•••${clean[clean.length - 1]}`;
  }

  const prefix = clean.slice(0, 2);
  const suffix = clean.slice(-1);
  return `${prefix}••••••${suffix}`;
}

/**
 * Resolve public canonical site URL from environment.
 */
export function getSiteUrl() {
  const raw =
    process.env.NEXTAUTH_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "https://rishabh-jh10c-pay-web.vercel.app";

  let url = String(raw).trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}

/**
 * Helper to sleep for exponential backoff during Discord 429s.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build Components V2 payload for Discord webhook.
 * Flags: 32768 (IS_COMPONENTS_V2). No content or embeds field!
 */
export function buildComponentsV2Payload({
  productTitle,
  productUrl,
  productImage,
  planLabel,
  amountFormatted,
  maskedCustomer,
  orderNumber,
  unixTimestamp,
  showCustomer = true,
  showImage = true,
  showButton = true,
  isTest = false,
  siteUrl,
}) {
  const titleDisplay = `### [${escapeDiscordMarkdown(productTitle)}](${productUrl})\n${
    isTest ? "🧪 **[TEST] New sale completed!**" : "🔥 **New sale completed!**"
  }`;

  const containerComponents = [];

  // 1. Top Section or Text Display
  if (showImage && productImage && /^https?:\/\//i.test(productImage)) {
    containerComponents.push({
      type: 9, // SECTION
      components: [
        {
          type: 10, // TEXT_DISPLAY
          content: titleDisplay,
        },
      ],
      accessory: {
        type: 11, // THUMBNAIL
        media: {
          url: productImage,
        },
      },
    });
  } else {
    containerComponents.push({
      type: 10, // TEXT_DISPLAY
      content: titleDisplay,
    });
  }

  // 2. Separator
  containerComponents.push({
    type: 14, // SEPARATOR
    divider: true,
    spacing: 1,
  });

  // 3. Product & Plan
  const planInfo = planLabel ? ` · ${escapeDiscordMarkdown(planLabel)}` : "";
  containerComponents.push({
    type: 10, // TEXT_DISPLAY
    content: `🏷️ **Product** · ${escapeDiscordMarkdown(productTitle)}${planInfo}`,
  });

  // 4. Amount, Method & Status
  containerComponents.push({
    type: 10, // TEXT_DISPLAY
    content: `💰 **Amount** ₹${amountFormatted}   💳 **Method** UPI   ✅ **Status** Completed`,
  });

  // 5. Customer & Order ID
  const customerPart = showCustomer
    ? `🔑 **Customer** \`${escapeDiscordMarkdown(maskedCustomer)}\`   `
    : "";
  containerComponents.push({
    type: 10, // TEXT_DISPLAY
    content: `${customerPart}🎫 **Order** \`#${orderNumber}\``,
  });

  // 6. Separator
  containerComponents.push({
    type: 14, // SEPARATOR
    divider: true,
    spacing: 1,
  });

  // 7. Small footer timestamp
  containerComponents.push({
    type: 10, // TEXT_DISPLAY
    content: `-# RISHABH JH10C PAY WEB • verified sale • <t:${unixTimestamp}:R>`,
  });

  // 8. Action Row with Link Button (style 5)
  if (showButton && productUrl) {
    containerComponents.push({
      type: 1, // ACTION_ROW
      components: [
        {
          type: 2, // BUTTON
          style: 5, // LINK
          label: "View Product",
          url: productUrl,
        },
      ],
    });
  }

  return {
    username: "RISHABH JH10C",
    avatar_url: `${siteUrl}/logo-icon.png`,
    flags: 32768, // IS_COMPONENTS_V2
    allowed_mentions: { parse: [] },
    components: [
      {
        type: 17, // CONTAINER
        accent_color: 16096779, // Amber / Golden (#f59e0b)
        components: containerComponents,
      },
    ],
  };
}

/**
 * Build standard Discord Embed payload as automatic fallback.
 */
export function buildEmbedFallbackPayload({
  productTitle,
  productUrl,
  productImage,
  planLabel,
  amountFormatted,
  maskedCustomer,
  orderNumber,
  unixTimestamp,
  showCustomer = true,
  showImage = true,
  isTest = false,
  siteUrl,
}) {
  const fields = [
    { name: "Amount", value: `₹${amountFormatted}`, inline: true },
    { name: "Method", value: "UPI", inline: true },
    { name: "Status", value: "✅ Completed", inline: true },
  ];

  if (showCustomer) {
    fields.push({
      name: "Customer",
      value: `\`${escapeDiscordMarkdown(maskedCustomer)}\``,
      inline: true,
    });
  }

  fields.push({
    name: "Order",
    value: `\`#${orderNumber}\``,
    inline: true,
  });

  const planText = planLabel ? ` (${planLabel})` : "";

  return {
    username: "RISHABH JH10C",
    avatar_url: `${siteUrl}/logo-icon.png`,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `${isTest ? "🧪 [TEST] " : "🔥 "}New Sale: ${productTitle}${planText}`,
        url: productUrl,
        color: 16096779,
        description: `**New sale completed successfully!**\n🏷️ **Product:** [${escapeDiscordMarkdown(
          productTitle
        )}](${productUrl})${escapeDiscordMarkdown(planText)}\n💰 **Amount:** ₹${amountFormatted} via UPI`,
        fields,
        thumbnail:
          showImage && productImage && /^https?:\/\//i.test(productImage)
            ? { url: productImage }
            : undefined,
        footer: {
          text: "RISHABH JH10C PAY WEB • Verified Sale",
          icon_url: `${siteUrl}/logo-icon.png`,
        },
        timestamp: new Date(unixTimestamp * 1000).toISOString(),
      },
    ],
  };
}

/**
 * Execute HTTP POST to a Discord webhook with 5s timeout, backoff on 429,
 * and automatic fallback from Components V2 to Classic Embed.
 */
async function postToDiscordWebhook(targetUrl, payload, isComponentsV2 = false) {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const urlToSend = isComponentsV2
        ? `${targetUrl}${targetUrl.includes("?") ? "&" : "?"}with_components=true`
        : targetUrl;

      const response = await fetch(urlToSend, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Handle 429 Rate Limiting with backoff
      if (response.status === 429) {
        let retryAfterMs = 1000;
        try {
          const rateData = await response.json();
          if (rateData?.retry_after) {
            retryAfterMs = Math.ceil(Number(rateData.retry_after) * 1000) + 150;
          }
        } catch {
          const header = response.headers.get("retry-after");
          if (header) {
            retryAfterMs = Math.ceil(Number(header) * 1000) + 150;
          }
        }

        if (attempt <= MAX_RETRIES) {
          await sleep(Math.min(retryAfterMs, 3000));
          continue;
        }
      }

      if (response.ok || response.status === 204) {
        return { ok: true, status: response.status };
      }

      const responseText = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        error: `Discord HTTP ${response.status}: ${responseText.slice(0, 200)}`,
      };
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err?.name === "AbortError";
      const errMsg = isTimeout ? "Request timed out after 5 seconds" : err?.message || "Network error";
      if (attempt <= MAX_RETRIES && !isTimeout) {
        await sleep(500 * attempt);
        continue;
      }
      return { ok: false, status: 0, error: errMsg };
    }
  }

  return { ok: false, status: 0, error: "Exceeded max retries" };
}

/**
 * Send Discord Sale Webhook.
 * First tries Components V2. If Discord returns an error (such as 400),
 * automatically falls back to standard Embed payload.
 */
export async function sendDiscordSaleWebhook({
  webhookUrl,
  order,
  isTest = false,
  showCustomer = true,
  showImage = true,
  showButton = true,
}) {
  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    throw new Error("Invalid Discord webhook URL format.");
  }

  const siteUrl = getSiteUrl();

  // Extract clean fields from order record
  const productName = String(order?.productName || order?.product?.name || "Digital Product").trim();
  const productId = String(order?.productId || order?.product?._id || order?.product || "").trim();
  const productSlug = String(order?.product?.slug || "").trim();
  const productUrl = `${siteUrl}/products/${productSlug || productId || ""}`;

  let productImage = "";
  if (order?.product?.imageUrl) {
    productImage = order.product.imageUrl;
  } else if (Array.isArray(order?.product?.images) && order.product.images.length > 0) {
    productImage = order.product.images[0];
  }

  const planLabel = String(order?.plan?.label || order?.planLabel || "").trim();

  const amountPaise = Number(order?.amountPaise) || Math.round((Number(order?.price) || 0) * 100);
  const amountFormatted = (amountPaise / 100).toFixed(2);

  const rawCustomer = order?.customerName || order?.email || order?.discordId || "Customer";
  const maskedCustomer = maskCustomerName(rawCustomer);

  const orderNumber = String(order?._id || "0000").slice(-6).toUpperCase();
  const unixTimestamp = Math.floor(
    (order?.paidAt ? new Date(order.paidAt).getTime() : Date.now()) / 1000
  );

  const sharedData = {
    productTitle: productName,
    productUrl,
    productImage,
    planLabel,
    amountFormatted,
    maskedCustomer,
    orderNumber,
    unixTimestamp,
    showCustomer,
    showImage,
    showButton,
    isTest,
    siteUrl,
  };

  // 1. Attempt Components V2
  const v2Payload = buildComponentsV2Payload(sharedData);
  const v2Result = await postToDiscordWebhook(webhookUrl, v2Payload, true);

  if (v2Result.ok) {
    return { ok: true, mode: "components_v2" };
  }

  // 2. Fallback to Rich Embed if Components V2 failed or was rejected (e.g. 400 Bad Request)
  console.warn(
    "Discord Components V2 delivery failed, falling back to classic Embed:",
    v2Result.error
  );

  const embedPayload = buildEmbedFallbackPayload(sharedData);
  const embedResult = await postToDiscordWebhook(webhookUrl, embedPayload, false);

  if (embedResult.ok) {
    return { ok: true, mode: "embed_fallback" };
  }

  throw new Error(embedResult.error || v2Result.error || "Failed to deliver webhook to Discord.");
}

/**
 * Public trigger to notify a sale after order completion.
 * Fully atomic, non-blocking, and double-processing proof.
 */
export async function notifySaleCompleted(orderIdOrDoc, { force = false } = {}) {
  await connectDB();

  const id = String(orderIdOrDoc?._id || orderIdOrDoc || "").trim();
  if (!/^[a-f\d]{24}$/i.test(id)) {
    return { ok: false, reason: "invalid_order_id" };
  }

  const order = await Order.findById(id).populate("product").lean();
  if (!order) {
    return { ok: false, reason: "order_not_found" };
  }

  if (order.status !== "completed") {
    return { ok: false, reason: "order_not_completed" };
  }

  // Atomic guard: check if already notified
  if (!force) {
    const lock = await Order.findOneAndUpdate(
      {
        _id: id,
        status: "completed",
        saleNotified: { $ne: true },
      },
      {
        $set: {
          saleNotified: true,
          notifiedAt: new Date(),
          notifyError: "",
        },
      },
      { new: true }
    ).lean();

    if (!lock) {
      return { ok: true, skipped: true, reason: "already_notified" };
    }
  }

  // Read settings from MongoDB
  const webhookUrl = await getSetting("sales_webhook_url", "");
  const webhookEnabled = await getSetting("sales_webhook_enabled", false);
  const showCustomer = await getSetting("sales_webhook_show_customer", true);
  const showImage = await getSetting("sales_webhook_show_image", true);
  const showButton = await getSetting("sales_webhook_show_button", true);

  if (!webhookEnabled || !webhookUrl) {
    return {
      ok: true,
      skipped: true,
      reason: "webhook_not_configured_or_disabled",
    };
  }

  try {
    const result = await sendDiscordSaleWebhook({
      webhookUrl,
      order,
      showCustomer: Boolean(showCustomer),
      showImage: Boolean(showImage),
      showButton: Boolean(showButton),
    });

    await Order.updateOne(
      { _id: id },
      {
        $set: {
          saleNotified: true,
          notifiedAt: new Date(),
          notifyError: "",
        },
      }
    );

    return { ok: true, mode: result.mode };
  } catch (err) {
    const errorMsg = String(err?.message || err).slice(0, 500);

    // Save error on the order and reset saleNotified so admin can see failure and retry
    await Order.updateOne(
      { _id: id },
      {
        $set: {
          saleNotified: false,
          notifyError: errorMsg,
        },
      }
    );

    return { ok: false, error: errorMsg };
  }
}

