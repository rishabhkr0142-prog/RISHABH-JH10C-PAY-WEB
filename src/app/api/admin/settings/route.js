import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { getSafeAdminSettings, setSetting } from "@/lib/settings";
import { isValidDiscordWebhookUrl } from "@/lib/discord-sale-webhook";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const settings = await getSafeAdminSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function POST(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();

    const allowedKeys = [
      "site_name",
      "support_email",
      "discord_invite",
      "order_cooldown_minutes",
      "default_theme",
      "sales_webhook_enabled",
      "sales_webhook_show_customer",
      "sales_webhook_show_image",
      "sales_webhook_show_button",
      "alerts_webhook_enabled",
    ];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        let val = body[key];
        if (key === "order_cooldown_minutes") {
          val = Math.max(0, Number(val) || 10);
        } else if (key.endsWith("_enabled") || key.startsWith("sales_webhook_show_")) {
          val = Boolean(val);
        }
        await setSetting(key, val);
      }
    }

    // Process Sales Webhook URL
    if (body.sales_webhook_url !== undefined) {
      const raw = String(body.sales_webhook_url).trim();
      // If user passed empty string, clear it
      if (!raw) {
        await setSetting("sales_webhook_url", "");
      } else if (!raw.includes("****") && !raw.includes("...")) {
        // Only update if it's a new, non-masked URL
        if (!isValidDiscordWebhookUrl(raw)) {
          return NextResponse.json(
            {
              error:
                "Invalid Discord Sales Webhook URL. It must start with https://discord.com/api/webhooks/ with valid ID and token.",
            },
            { status: 400 }
          );
        }
        await setSetting("sales_webhook_url", raw);
      }
    }

    // Process Alerts Webhook URL
    if (body.alerts_webhook_url !== undefined) {
      const raw = String(body.alerts_webhook_url).trim();
      if (!raw) {
        await setSetting("alerts_webhook_url", "");
      } else if (!raw.includes("****") && !raw.includes("...")) {
        if (!isValidDiscordWebhookUrl(raw)) {
          return NextResponse.json(
            {
              error:
                "Invalid Discord Alerts Webhook URL. It must start with https://discord.com/api/webhooks/ with valid ID and token.",
            },
            { status: 400 }
          );
        }
        await setSetting("alerts_webhook_url", raw);
      }
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");

    const updated = await getSafeAdminSettings();
    return NextResponse.json({ ok: true, settings: updated });
  } catch (err) {
    console.error("POST /api/admin/settings error:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
