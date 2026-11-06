import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { notifySaleCompleted } from "@/lib/discord-sale-webhook";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const id = params?.id;
  if (!id || !/^[a-f\d]{24}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
  }

  try {
    await connectDB();
    const order = await Order.findById(id).lean();

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status !== "completed") {
      return NextResponse.json(
        {
          error:
            "Sale notification can only be sent for completed orders with verified payment and delivery.",
        },
        { status: 400 }
      );
    }

    const result = await notifySaleCompleted(id, { force: true });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Failed to send sale notification to Discord." },
        { status: 500 }
      );
    }

    revalidatePath("/admin/orders");

    return NextResponse.json({
      ok: true,
      message: `Sale notification sent to Discord! (${
        result.mode === "components_v2" ? "Components V2" : "Classic Embed"
      })`,
    });
  } catch (err) {
    console.error("Resend sale webhook error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to resend sale notification." },
      { status: 500 }
    );
  }
}

