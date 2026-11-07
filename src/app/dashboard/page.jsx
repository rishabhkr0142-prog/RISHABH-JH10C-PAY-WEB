import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { findUserForSession } from "@/lib/account";
import Product from "@/models/Product"; // ensure Product model registered for populate
import { toPlainText } from "@/lib/serialize";
import { ownerFilterFor, redactOrderLicense } from "@/lib/order-access";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard",
  description: "Manage your purchases, order history, and account profile.",
};

const PAGE_SIZE = 50;

export default async function DashboardPage({ searchParams }) {
  const session = await getSession();

  // Route protection
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  let dbUser = null;
  let orders = [];
  let stats = { totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalSpent: 0 };
  let pagination = { page: 1, totalPages: 1, total: 0 };

  try {
    await connectDB();

    // 1. Fetch the canonical user profile from DB
    if (session.user.id) {
      const userDoc = await findUserForSession(session);
      dbUser = userDoc?.toObject ? userDoc.toObject() : userDoc;
    }

    const requested = Number(searchParams?.page);
    const page = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1;
    const ownerFilter = ownerFilterFor(session, dbUser) || {};

    // 2. Compute exact stats with aggregation (never load every order).
    const [statRow] = await Order.aggregate([
      { $match: ownerFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          completedOrders: {
            $sum: {
              $cond: [{ $in: ["$status", ["completed", "paid"]] }, 1, 0],
            },
          },
          totalSpent: {
            $sum: {
              $cond: [
                { $in: ["$status", ["completed", "paid"]] },
                { $ifNull: ["$price", { $ifNull: ["$amount", 0] }] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const total = Number(statRow?.totalOrders) || 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);

    stats = {
      totalOrders: total,
      pendingOrders: Number(statRow?.pendingOrders) || 0,
      completedOrders: Number(statRow?.completedOrders) || 0,
      totalSpent: Number(statRow?.totalSpent) || 0,
    };
    pagination = { page: safePage, totalPages, total };

    // 3. Fetch only the current page, with a projection that drops heavy fields.
    const orderDocs = await Order.find(ownerFilter)
      .select("-stockReservation -stockError -licenseAttempts -deliveryAttempts")
      .populate("product", "name slug images imageUrl price")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();

    orders = toPlainText(orderDocs).map((order) =>
      redactOrderLicense(order, session, dbUser)
    );
    if (dbUser) {
      dbUser = toPlainText(dbUser);
    }
  } catch (err) {
    console.error("Dashboard data load error:", err?.message || err);
  }

  const initialTab = searchParams?.tab || "overview";
  const linked = typeof searchParams?.linked === "string" ? searchParams.linked : "";
  const linkError =
    typeof searchParams?.linkError === "string" ? searchParams.linkError : "";

  return (
    <DashboardClient
      session={session}
      dbUser={dbUser}
      orders={orders}
      stats={stats}
      pagination={pagination}
      initialTab={initialTab}
      linked={linked}
      linkError={linkError}
    />
  );
}
