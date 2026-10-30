import connectDB from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import Client from "@/models/Client";
import Stat from "@/models/Stat";

/**
 * Stats helpers — queries live counts from MongoDB collections.
 */

/** Get live public stats directly from MongoDB */
export async function getPublicStats() {
  await connectDB();

  try {
    const [userCount, orderCount, userClientCount, legacyClientCount] = await Promise.all([
      User.countDocuments().catch(() => 0),
      Order.countDocuments().catch(() => 0),
      User.countDocuments({ role: "client" }).catch(() => 0),
      Client.countDocuments().catch(() => 0),
    ]);

    const clients = userClientCount > 0 ? userClientCount : legacyClientCount;

    return {
      users: userCount,
      orders: orderCount,
      clients: clients,
      updatedAt: new Date(),
    };
  } catch (err) {
    console.error("Live stats fetch failed, falling back to Stat doc:", err?.message || err);
    const stat = await getStatDoc();
    return {
      users: stat.users || 0,
      orders: stat.orders || 0,
      clients: stat.clients || 0,
      updatedAt: stat.updatedAt,
    };
  }
}

/** Get (or lazily create + seed) the global stats document. */
export async function getStatDoc() {
  await connectDB();

  let stat = await Stat.findOne({ key: "global" });

  if (!stat) {
    const [users, orders, clients] = await Promise.all([
      User.countDocuments().catch(() => 0),
      Order.countDocuments().catch(() => 0),
      Client.countDocuments().catch(() => 0),
    ]);
    stat = await Stat.create({ key: "global", users, orders, clients });
  }

  return stat;
}

/** Increment one counter by 1. */
export async function incrementStat(field) {
  if (!["users", "orders", "clients"].includes(field)) return;
  try {
    await getStatDoc();
    await Stat.updateOne({ key: "global" }, { $inc: { [field]: 1 } });
  } catch (e) {
    // Stat doc update is optional as we query live counts
  }
}

/** Decrement one counter by 1. */
export async function decrementStat(field) {
  if (!["users", "orders", "clients"].includes(field)) return;
  try {
    await getStatDoc();
    await Stat.updateOne({ key: "global" }, [
      {
        $set: { [field]: { $max: [0, { $subtract: [`$${field}`, 1] }] } },
      },
    ]);
  } catch (e) {
    // Stat doc update is optional
  }
}

/** Set custom manual overrides for stats */
export async function setStats({ users, orders, clients } = {}) {
  await getStatDoc();
  const update = {};
  if (users !== undefined && users >= 0) update.users = Number(users);
  if (orders !== undefined && orders >= 0) update.orders = Number(orders);
  if (clients !== undefined && clients >= 0) update.clients = Number(clients);
  update.updatedAt = new Date();

  return Stat.updateOne({ key: "global" }, { $set: update });
}
