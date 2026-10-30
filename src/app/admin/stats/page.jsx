import connectDB from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import Client from "@/models/Client";
import { getPublicStats } from "@/lib/stats";
import StatsManager from "./StatsManager";

/**
 * ADMIN /admin/stats — manually correct the numbers shown on the home page.
 * Shows the current cached values next to the real collection counts so you
 * can spot drift and fix it with one click.
 */
export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  const cached = await getPublicStats();

  await connectDB();
  const [realUsers, realOrders, realClients] = await Promise.all([
    User.estimatedDocumentCount(),
    Order.estimatedDocumentCount(),
    Client.estimatedDocumentCount(),
  ]);

  return (
    <StatsManager
      cached={{
        users: cached.users,
        orders: cached.orders,
        clients: cached.clients,
      }}
      real={{ users: realUsers, orders: realOrders, clients: realClients }}
    />
  );
}
