import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
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

    // 1. Fetch user profile from DB
    if (session.user.id) {
      dbUser = await User.findOne({ discordId: session.user.id }).lean();
    }

    // 2. Fetch orders strictly belonging to this logged-in Discord account
    const orderDocs = await Order.find(ownerFilterFor(session, dbUser))
      .populate("product")
      .sort({ createdAt: -1 })
      .lean();

    orders = toPlainText(orderDocs).map((order) =>
      redactOrderLicense(order, session)
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

  return (
    <DashboardClient
      session={session}
      dbUser={dbUser}
      orders={orders}
      stats={stats}
      initialTab={initialTab}
    />
  );
}
