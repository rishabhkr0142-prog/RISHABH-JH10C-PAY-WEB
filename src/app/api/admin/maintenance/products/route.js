import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { logMaintenanceAction } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/maintenance/products
 * Bulk update maintenance status for a list of products.
 *
 * Body:
 * {
 *   productIds: string[],
 *   maintenance: boolean,
 *   reason?: string
 * }
 */
export async function POST(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const productIds = Array.isArray(body?.productIds)
      ? body.productIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];
    const maintenance = Boolean(body?.maintenance);
    const reason = String(body?.reason || "").trim();

    if (productIds.length === 0) {
      return NextResponse.json(
        { error: "No valid products selected." },
        { status: 400 }
      );
    }

    if (maintenance && !reason) {
      return NextResponse.json(
        { error: "A maintenance reason is required when placing products under maintenance." },
        { status: 400 }
      );
    }

    if (reason.length > 200) {
      return NextResponse.json(
        { error: "Maintenance reason must be 200 characters or fewer." },
        { status: 400 }
      );
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      {
        $set: {
          maintenance,
          maintenanceReason: maintenance ? reason : "",
        },
      }
    );

    await logMaintenanceAction({
      adminId: String(session.user.id || ""),
      adminEmail: String(session.user.email || session.user.name || ""),
      targetType: "bulk_product",
      targetId: productIds.slice(0, 10).join(",") + (productIds.length > 10 ? "..." : ""),
      targetName: `${productIds.length} product${productIds.length > 1 ? "s" : ""}`,
      action: maintenance ? "enable" : "disable",
      reason: maintenance ? reason : "Maintenance disabled by admin",
      productCount: productIds.length,
      details: { productIds, modifiedCount: result.modifiedCount },
    });

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin/maintenance");
    for (const id of productIds) {
      revalidatePath(`/products/${id}`);
    }

    return NextResponse.json({
      ok: true,
      modifiedCount: result.modifiedCount,
      message: maintenance
        ? `${result.modifiedCount} product(s) placed under maintenance.`
        : `${result.modifiedCount} product(s) removed from maintenance.`,
    });
  } catch (err) {
    console.error("POST /api/admin/maintenance/products error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

