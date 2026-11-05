import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Order, { ORDER_STATUSES } from "@/models/Order";
import { decrementStat } from "@/lib/stats";
import { completeOrder } from "@/lib/fulfillment";
import {
  ensureStockForPayment,
  releaseProductStockItem,
  releaseProductStockReservation,
} from "@/lib/product-stock";
import { normalizeDeliveryType } from "@/lib/delivery-content";

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

    const current = await Order.findById(id).lean();
    if (!current) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Enforce a sane state machine so an order can never jump from pending
    // straight to completed without a verified payment and a license key.
    const ALLOWED_TRANSITIONS = {
      pending: ["paid", "cancelled", "expired"],
      expired: ["paid", "cancelled"],
      paid: ["completed", "cancelled"],
      processing: ["paid", "completed"],
      completed: [],
      cancelled: ["paid"],
    };
    const allowed = ALLOWED_TRANSITIONS[current.status] || [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        {
          error: `Cannot change status from "${current.status}" to "${body.status}".`,
        },
        { status: 400 }
      );
    }

    const isContent = normalizeDeliveryType(current.deliveryType) === "content";
    if (
      body.status === "completed" &&
      (isContent ? !current.deliveryContent : !current.licenseKey)
    ) {
      return NextResponse.json(
        {
          error: isContent
            ? "An order can only be completed after its delivery content has been saved."
            : "An order can only be completed after its license key has been delivered.",
        },
        { status: 400 }
      );
    }

    if (body.status === "paid" && current.status !== "paid") {
      const stockCheck = await ensureStockForPayment(current);
      if (!stockCheck.ok) {
        return NextResponse.json(
          {
            error:
              stockCheck.reason === "out_of_stock"
                ? "This product is out of stock. Restock it before marking the order paid."
                : "Inventory could not be reserved for this order.",
          },
          { status: 409 }
        );
      }
    }

    const updates = { status: body.status };
    if (body.status === "paid" && !current.paidAt) {
      updates.paidAt = new Date();
    }

    let order = await Order.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).lean();

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (body.status === "cancelled" || body.status === "expired") {
      await releaseProductStockReservation(order, `order_${body.status}`);
    }

    // Marking an order as paid triggers automatic delivery.
    if (
      body.status === "paid" &&
      !order.licenseKey &&
      !order.deliveryContent
    ) {
      try {
        const fulfillment = await completeOrder(order._id);
        if (fulfillment?.order) order = fulfillment.order;
      } catch (fulfillmentErr) {
        console.error(
          "Fulfillment failed after admin mark-paid:",
          fulfillmentErr?.message || fulfillmentErr
        );
      }
    }

    revalidatePath("/admin/orders");
    revalidatePath("/dashboard");
    revalidatePath(`/checkout/${id}`);

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

    const current = await Order.findById(id).lean();
    if (!current) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    await releaseProductStockReservation(current, "order_deleted");

    const deleted = await Order.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    await releaseProductStockItem(id);
    await decrementStat("orders");
    revalidatePath("/admin/orders");
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/orders/[id]:", err);
    return NextResponse.json({ error: "Could not delete order." }, { status: 500 });
  }
}
