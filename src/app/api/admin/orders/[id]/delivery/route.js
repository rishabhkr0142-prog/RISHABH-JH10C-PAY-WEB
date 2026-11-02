import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { toPlainText } from "@/lib/serialize";
import {
  normalizeDeliveryType,
  sanitizeDeliveryContentInput,
} from "@/lib/delivery-content";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/orders/:id/delivery
 * Edit the delivery-content snapshot for a completed content order.
 */
export async function PATCH(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const id = params?.id;
  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
  }

  try {
    await connectDB();

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (normalizeDeliveryType(order.deliveryType) !== "content") {
      return NextResponse.json(
        { error: "Only content-delivery orders can be edited here." },
        { status: 400 }
      );
    }

    if (order.status !== "completed") {
      return NextResponse.json(
        {
          error:
            "Delivery content can only be edited after the order is completed.",
        },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const sanitized = sanitizeDeliveryContentInput(body);
    if (!sanitized.ok) {
      return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }
    if (!sanitized.hasDeliveryBody) {
      return NextResponse.json(
        { error: "Delivery content needs a link or message." },
        { status: 400 }
      );
    }

    const existing =
      order.deliveryContent?.toObject?.() || order.deliveryContent || {};

    const deliveryContent = {
      ...existing,
      title: sanitized.value.deliveryTitle,
      link: sanitized.value.deliveryLink,
      message: sanitized.value.deliveryMessage,
      buttonLabel: sanitized.value.deliveryButtonLabel,
      stockItem: String(existing.stockItem || ""),
    };

    const updated = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          deliveryContent,
          deliveryError: "",
        },
      },
      { new: true, runValidators: true }
    ).lean();

    revalidatePath("/admin/orders");
    revalidatePath("/dashboard");
    revalidatePath(`/checkout/${id}`);

    return NextResponse.json({
      ok: true,
      order: toPlainText(updated),
    });
  } catch (err) {
    console.error(
      "PATCH /api/admin/orders/[id]/delivery failed:",
      err?.message || err
    );
    return NextResponse.json(
      { error: "Could not update delivery content." },
      { status: 500 }
    );
  }
}
