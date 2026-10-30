import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Client from "@/models/Client";
import { incrementStat } from "@/lib/stats";

/**
 * POST /api/admin/clients — add a client manually.
 * Body: { name, email?, discordId?, totalSpent?, notes? }
 * (Adds +1 to the "Total Clients" stat.)
 */
export async function POST(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const body = await request.json();

    if (!body?.name || String(body.name).trim() === "") {
      return NextResponse.json({ error: "Client name is required." }, { status: 400 });
    }

    const totalSpent = Number(body.totalSpent || 0);
    if (Number.isNaN(totalSpent) || totalSpent < 0) {
      return NextResponse.json({ error: "totalSpent must be a positive number." }, { status: 400 });
    }

    await Client.create({
      name: String(body.name).trim(),
      email: String(body.email || "").trim(),
      discordId: String(body.discordId || "").trim(),
      totalSpent,
      notes: String(body.notes || "").trim(),
    });

    await incrementStat("clients");
    revalidatePath("/admin/clients");
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/admin/clients:", err);
    return NextResponse.json({ error: "Could not add client." }, { status: 500 });
  }
}
