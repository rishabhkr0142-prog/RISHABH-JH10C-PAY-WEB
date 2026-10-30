import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { setStats } from "@/lib/stats";

/**
 * PUT /api/admin/stats — manually update the live stat counts.
 * Body: any subset of { users, orders, clients } (numbers, ≥ 0).
 */
export async function PUT(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    await setStats({
      users: body?.users,
      orders: body?.orders,
      clients: body?.clients,
    });

    revalidatePath("/");
    revalidatePath("/admin/stats");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/stats:", err);
    return NextResponse.json({ error: "Could not update stats." }, { status: 500 });
  }
}
