import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Order, { ORDER_STATUSES } from "@/models/Order";
import { decrementStat } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/orders/:id — update order status.
 * Body: { status: "pending" | "processing" | "completed" | "cancelled" }
 */
export async function PATCH(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const id = params?.id;
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
    }

    const body = await request.json();
    if (!ORDER_STATUSES.includes(body?.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${ORDER_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { status: body.status },
      { new: true, runValidators: true }
    ).lean();

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    revalidatePath("/admin/orders");

    return NextResponse.json({ ok: true, order: JSON.parse(JSON.stringify(order)) });
  } catch (err) {
    console.error("PATCH /api/admin/orders/[id]:", err);
    return NextResponse.json({ error: "Could not update order." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/orders/:id — delete an order.
 * (Subtracts 1 from the "Total Orders" stat to stay in sync.)
 */
export async function DELETE(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    await connectDB();
    const id = params?.id;
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
    }

    const deleted = await Order.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    await decrementStat("orders");
    revalidatePath("/admin/orders");
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/orders/[id]:", err);
    return NextResponse.json({ error: "Could not delete order." }, { status: 500 });
  }
}
