import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import connectDB from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";
import { logMaintenanceAction } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/maintenance/category
 * Toggles maintenance mode for an entire category.
 * If enabling (maintenance=true), a non-empty reason is required (max 200 chars).
 * maintenanceUntil is optional (max 100 chars).
 */
export async function POST(request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const maintenance = Boolean(body?.maintenance);
    const reason = String(body?.reason || "").trim();
    const maintenanceUntil = String(body?.maintenanceUntil || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    }

    if (maintenance && !reason) {
      return NextResponse.json(
        { error: "A maintenance reason is required when enabling maintenance mode." },
        { status: 400 }
      );
    }

    if (reason.length > 200) {
      return NextResponse.json(
        { error: "Maintenance reason must be 200 characters or fewer." },
        { status: 400 }
      );
    }

    if (maintenanceUntil.length > 100) {
      return NextResponse.json(
        { error: "Expected until text must be 100 characters or fewer." },
        { status: 400 }
      );
    }

    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const categoryDoc = await Category.findOneAndUpdate(
      { name: { $regex: new RegExp(`^${escapedName}$`, "i") } },
      {
        $set: {
          name,
          maintenance,
          maintenanceReason: maintenance ? reason : "",
          maintenanceUntil: maintenance ? maintenanceUntil : "",
          maintenanceSince: maintenance ? new Date() : null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const affectedCount = await Product.countDocuments({
      category: { $regex: new RegExp(`^${escapedName}$`, "i") },
    });

    await logMaintenanceAction({
      adminId: String(session.user.id || ""),
      adminEmail: String(session.user.email || session.user.name || ""),
      targetType: "category",
      targetId: String(categoryDoc._id || name),
      targetName: name,
      action: maintenance ? "enable" : "disable",
      reason: maintenance ? reason : "Maintenance disabled by admin",
      maintenanceUntil: maintenance ? maintenanceUntil : "",
      productCount: affectedCount,
      details: { categoryName: name, affectedProducts: affectedCount },
    });

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin/maintenance");

    return NextResponse.json({
      ok: true,
      category: JSON.parse(JSON.stringify(categoryDoc)),
      affectedCount,
      message: maintenance
        ? `Category "${name}" (${affectedCount} products) is now under maintenance.`
        : `Category "${name}" maintenance has been turned off.`,
    });
  } catch (err) {
    console.error("POST /api/admin/maintenance/category error:", err);
    return NextResponse.json(
      { error: "Failed to update category maintenance status." },
      { status: 500 }
    );
  }
}

