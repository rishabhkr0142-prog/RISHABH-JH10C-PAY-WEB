import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { retryOrderFulfillment } from "@/lib/fulfillment";
import { toPlainText } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const REASON_MESSAGES = {
  invalid_order_id: "Invalid order id.",
  not_found: "Order not found.",
  not_paid: "Only paid orders can receive delivery details.",
  processing: "Delivery is already in progress. Please wait.",
  generation_failed: "Delivery failed. Please retry.",
  out_of_stock: "This product is out of stock.",
};

/**
 * POST /api/admin/orders/:id/retry-license
 * Retries key generation for a paid/failed order. Admin only.
 */
export async function POST(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const id = params?.id;
  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
  }

  try {
    const result = await retryOrderFulfillment(id);

    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "processing"
            ? 409
            : 400;

      return NextResponse.json(
        {
          error: REASON_MESSAGES[result.reason] || "Could not complete delivery.",
          reason: result.reason,
          detail: result.error || "",
          order: result.order ? toPlainText(result.order) : null,
        },
        { status }
      );
    }

    revalidatePath("/admin/orders");
    revalidatePath("/dashboard");
    revalidatePath(`/checkout/${id}`);

    return NextResponse.json({
      ok: true,
      alreadyCompleted: Boolean(result.alreadyCompleted),
      order: toPlainText(result.order),
    });
  } catch (err) {
    console.error(
      "POST /api/admin/orders/[id]/retry-license failed:",
      err?.message || err
    );
    return NextResponse.json(
      { error: "Delivery retry failed. Please try again." },
      { status: 500 }
    );
  }
}
