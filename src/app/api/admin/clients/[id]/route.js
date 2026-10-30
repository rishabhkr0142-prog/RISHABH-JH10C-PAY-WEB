import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Client from "@/models/Client";
import { decrementStat } from "@/lib/stats";

/**
 * DELETE /api/admin/clients/:id — remove a client.
 * (Subtracts 1 from the "Total Clients" stat to stay in sync.)
 */
export async function DELETE(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const id = params?.id;
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid client id." }, { status: 400 });
    }

    const deleted = await Client.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    await decrementStat("clients");
    revalidatePath("/admin/clients");
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/clients/[id]:", err);
    return NextResponse.json({ error: "Could not delete client." }, { status: 500 });
  }
}
