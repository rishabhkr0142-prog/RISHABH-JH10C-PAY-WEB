import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { getAllSettings, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const settings = await getAllSettings();
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
    ];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        let val = body[key];
        if (key === "order_cooldown_minutes") {
          val = Math.max(0, Number(val) || 10);
        }
        await setSetting(key, val);
      }
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings");

    const updated = await getAllSettings();
    return NextResponse.json({ ok: true, settings: updated });
  } catch (err) {
    console.error("POST /api/admin/settings error:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
