import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { setResellerStatus } from "@/lib/reseller-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/resellers/:id — manually grant or revoke reseller status.
 * Body: { action: "make" | "remove" }
 */
export async function POST(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const id = params?.id;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (!["make", "remove"].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "make" or "remove".' },
        { status: 400 }
      );
    }

    const result = await setResellerStatus(id, action === "make");
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Could not update reseller status." },
        { status: result.status || 400 }
      );
    }

    revalidatePath("/admin/resellers");
    revalidatePath("/admin");
    revalidatePath("/reseller");
    revalidatePath("/dashboard");

    return NextResponse.json({ ok: true, user: result.user });
  } catch (err) {
    console.error("POST /api/admin/resellers/[id] failed:", err);
    return NextResponse.json(
      { error: "Could not update reseller status." },
      { status: 500 }
    );
  }
}
