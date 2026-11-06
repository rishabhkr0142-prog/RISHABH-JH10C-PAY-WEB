import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getSetting } from "@/lib/settings";
import {
  isValidDiscordWebhookUrl,
  sendDiscordSaleWebhook,
} from "@/lib/discord-sale-webhook";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const type = body?.type || "sales";
    let targetUrl = String(body?.url || "").trim();

    // If no URL provided or URL is masked, read from database
    if (!targetUrl || targetUrl.includes("****") || targetUrl.includes("...")) {
      const settingKey = type === "alerts" ? "alerts_webhook_url" : "sales_webhook_url";
      targetUrl = await getSetting(settingKey, "");
    }

    if (!targetUrl) {
      return NextResponse.json(
        {
          error:
            "No webhook URL configured. Please enter a valid Discord webhook URL and save it first.",
        },
        { status: 400 }
      );
    }

    if (!isValidDiscordWebhookUrl(targetUrl)) {
      return NextResponse.json(
        {
          error:
            "Invalid Discord webhook URL format. It must start with https://discord.com/api/webhooks/.",
        },
        { status: 400 }
      );
    }

    if (type === "sales") {
      const mockOrder = {
        _id: "507f1f77bcf86cd799439011",
        productName: "Discord Nitro 1 Year [TEST SALE]",
        productId: "test-product-id",
        product: {
          name: "Discord Nitro 1 Year [TEST SALE]",
          slug: "discord-nitro",
          imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80",
        },
        plan: {
          label: "1 Year (365 Days)",
          days: 365,
        },
        price: 199.00,
        amountPaise: 19900,
        customerName: "Rishabh Tester",
        discordId: "1557984876894887937",
        paidAt: new Date(),
        status: "completed",
      };

      const result = await sendDiscordSaleWebhook({
        webhookUrl: targetUrl,
        order: mockOrder,
        isTest: true,
        showCustomer: body?.showCustomer !== undefined ? Boolean(body.showCustomer) : true,
        showImage: body?.showImage !== undefined ? Boolean(body.showImage) : true,
        showButton: body?.showButton !== undefined ? Boolean(body.showButton) : true,
      });

      return NextResponse.json({
        ok: true,
        mode: result.mode,
        message: `Test sale notification sent to Discord! (Delivered via ${
          result.mode === "components_v2" ? "Discord Components V2" : "Classic Embed"
        })`,
      });
    }

    // Alerts Webhook Test
    const alertPayload = {
      username: "RISHABH JH10C ALERTS",
      content: "🧪 **[TEST ALERT]** Admin alerts webhook is configured and working properly!",
      allowed_mentions: { parse: [] },
    };

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alertPayload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Discord rejected webhook (HTTP ${res.status}): ${text.slice(0, 160)}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Test admin alert sent to Discord successfully!",
    });
  } catch (err) {
    console.error("Test webhook error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to deliver test webhook to Discord." },
      { status: 500 }
    );
  }
}

