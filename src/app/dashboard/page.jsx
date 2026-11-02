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

export default async function DashboardPage({ searchParams }) {
  const session = await getSession();

  // Route protection
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  let dbUser = null;
  let orders = [];

  try {
    await connectDB();

    // 1. Fetch the canonical user profile from DB
    if (session.user.id) {
      const userDoc = await findUserForSession(session);
      dbUser = userDoc?.toObject ? userDoc.toObject() : userDoc;
    }

    // 2. Fetch orders strictly belonging to this logged-in Discord account
    const orderDocs = await Order.find(ownerFilterFor(session, dbUser))
      .populate("product")
      .sort({ createdAt: -1 })
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

  // 3. Compute stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const completedOrders = orders.filter((o) => o.status === "completed" || o.status === "paid").length;
  const totalSpent = orders
    .filter((o) => o.status === "completed" || o.status === "paid")
    .reduce((sum, o) => sum + (Number(o.price || o.amount) || 0), 0);

  const stats = {
    totalOrders,
    pendingOrders,
    completedOrders,
    totalSpent,
  };

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
      initialTab={initialTab}
      linked={linked}
      linkError={linkError}
    />
  );
}
