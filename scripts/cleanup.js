const { connect, disconnect, formatBytes } = require("./lib/db");

/**
 * Conservative cleanup for temporary / expired / obvious test data.
 *
 * Usage:
 *   node scripts/cleanup.js            # DRY RUN: only prints what would be deleted
 *   node scripts/cleanup.js --confirm  # actually deletes the listed records
 *
 * Optional:
 *   --pending-hours=24   Pending orders older than N hours
 *   --logs-days=7        Temp logs/idempotency older than N days
 *   --payments-days=7    Unclaimed payments older than N days
 */

const args = process.argv.slice(2);
const CONFIRM = args.includes("--confirm");

function argValue(name, fallback) {
  const raw = args.find((item) => item.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.split("=")[1]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const PENDING_HOURS = argValue("pending-hours", 24);
const LOGS_DAYS = argValue("logs-days", 7);
const PAYMENTS_DAYS = argValue("payments-days", 7);

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);
const daysAgo = (days) => hoursAgo(days * 24);
const DUMMY_RE = /^(test|dummy|sample|demo)([-_\s]|$)/i;

function toObjectId(mongoose, value) {
  const raw = String(value || "");
  return mongoose.Types.ObjectId.isValid(raw)
    ? new mongoose.Types.ObjectId(raw)
    : null;
}

function planSelector(mongoose, snapshot) {
  const id = toObjectId(mongoose, snapshot?._id || snapshot?.planId);
  if (id) return { _id: id };

  const label = String(snapshot?.label || snapshot?.planLabel || "").trim();
  if (label) return { label };

  const days = snapshot?.days;
  if (days !== undefined && days !== null && days !== "") {
    return { days: Number(days) };
  }
  return null;
}

/**
 * Pending orders may still hold reserved stock. Release units before deleting
 * so the cleanup cannot leak reserved inventory.
 */
async function releaseOrderStock(mongoose, db, order) {
  if (
    !order.stockReserved ||
    order.stockCommitted ||
    order.stockReleased ||
    order.stockReservation?.mode !== "limited"
  ) {
    return false;
  }

  const productId = toObjectId(mongoose, order.stockReservation.productId);
  if (!productId) return false;

  const claim = await db.collection("orders").updateOne(
    {
      _id: order._id,
      stockReserved: true,
      stockCommitted: { $ne: true },
      stockReleased: { $ne: true },
    },
    { $set: { stockReserved: false, stockReleased: true } }
  );
  if (!claim.modifiedCount) return false;

  const snapshot = order.stockReservation;
  const qty = Math.max(1, Number(snapshot.quantity) || 1);
  const selector = planSelector(mongoose, snapshot);

  if (snapshot.scope === "plan" && selector) {
    await db.collection("products").updateOne(
      { _id: productId, plans: { $elemMatch: { ...selector, reserved: { $gte: qty } } } },
      { $inc: { "plans.$.stock": qty, "plans.$.reserved": -qty } }
    );
  } else {
    await db.collection("products").updateOne(
      { _id: productId, reserved: { $gte: qty } },
      { $inc: { stock: qty, reserved: -qty } }
    );
  }

  return true;
}

async function main() {
  const { mongoose, db, dbName } = await connect();
  console.log(`\nDatabase: ${dbName}`);
  console.log(CONFIRM ? "MODE: CONFIRM (records WILL be deleted)\n" : "MODE: DRY RUN (nothing will be deleted)\n");

  const existing = new Set(
    (await db.listCollections().toArray())
      .filter((info) => info.type !== "view")
      .map((info) => info.name)
  );

  const targets = [];
  const add = (collection, description, query) => {
    if (!existing.has(collection)) {
      console.log(`SKIP  ${collection}: collection does not exist`);
      return;
    }
    targets.push({ collection, description, query });
  };

  // Pending orders that expired more than N hours ago and never got a payment.
  add(
    "orders",
    `pending orders older than ${PENDING_HOURS}h with no payment`,
    {
      status: "pending",
      expiresAt: { $lt: hoursAgo(PENDING_HOURS) },
      $or: [{ paymentId: null }, { paymentId: { $exists: false } }],
      $and: [{ $or: [{ licenseKey: { $in: ["", null] } }, { licenseKey: { $exists: false } }] }],
    }
  );

  // Incoming payments that were never matched to an order.
  add(
    "payments",
    `unclaimed payments older than ${PAYMENTS_DAYS}d`,
    { status: "unclaimed", receivedAt: { $lt: daysAgo(PAYMENTS_DAYS) } }
  );

  // Idempotency rows have a 48h TTL, but remove them here too if TTL is off.
  add("idempotency_keys", "idempotency keys older than 48h", {
    createdAt: { $lt: hoursAgo(48) },
  });

  // Temporary audit logs (TTL also removes these after 7 days).
  add("payment_logs", `payment logs older than ${LOGS_DAYS}d`, {
    createdAt: { $lt: daysAgo(LOGS_DAYS) },
  });
  add("stock_logs", `stock logs older than ${LOGS_DAYS}d`, {
    createdAt: { $lt: daysAgo(LOGS_DAYS) },
  });

  // Only if these legacy collections exist.
  add("sessions", "expired database sessions", {
    $or: [{ expires: { $lt: new Date() } }, { expiresAt: { $lt: new Date() } }],
  });
  add("rate_limits", "expired rate-limit records", {
    $or: [
      { expiresAt: { $lt: new Date() } },
      { resetAt: { $lt: new Date() } },
    ],
  });

  // Obvious test/dummy records (shown in dry run first).
  add("products", "test/dummy products", {
    $or: [{ name: DUMMY_RE }, { slug: DUMMY_RE }],
  });
  add("orders", "test/dummy orders", {
    $or: [
      { customerName: DUMMY_RE },
      { email: DUMMY_RE },
      { productName: DUMMY_RE },
    ],
  });
  add("users", "test/dummy users", {
    $or: [{ username: DUMMY_RE }, { email: DUMMY_RE }],
  });

  let totalDocuments = 0;
  let totalBytes = 0;

  for (const target of targets) {
    const collection = db.collection(target.collection);
    const count = await collection.countDocuments(target.query).catch(() => 0);

    let sample = [];
    if (count > 0) {
      sample = await collection
        .find(target.query)
        .project({
          _id: 1,
          name: 1,
          orderNo: 1,
          username: 1,
          utr: 1,
          customerName: 1,
          createdAt: 1,
        })
        .limit(5)
        .toArray();
    }

    let bytes = 0;
    if (count > 0) {
      try {
        const sizeRows = await collection
          .aggregate([
            { $match: target.query },
            { $group: { _id: null, total: { $sum: { $bsonSize: "$$ROOT" } } } },
          ])
          .toArray();
        bytes = Number(sizeRows?.[0]?.total) || 0;
      } catch {
        bytes = 0;
      }
    }

    totalDocuments += count;
    totalBytes += bytes;

    console.log(`${target.collection}: ${count} · ${target.description} · ${formatBytes(bytes)}`);
    for (const doc of sample) {
      const label =
        doc.orderNo ||
        doc.name ||
        doc.username ||
        doc.utr ||
        doc.customerName ||
        String(doc._id);
      console.log(`    - ${label}`);
    }
    if (count > sample.length) {
      console.log(`    ...and ${count - sample.length} more`);
    }
  }

  console.log(`\nTotal: ${totalDocuments} document(s) · ${formatBytes(totalBytes)}\n`);

  if (!CONFIRM) {
    console.log("DRY RUN complete. Nothing was deleted.");
    console.log("Re-run with --confirm to delete the records listed above.\n");
    await disconnect();
    return;
  }

  console.log("Deleting...\n");
  for (const target of targets) {
    const collection = db.collection(target.collection);

    if (target.collection === "orders") {
      const orders = await collection
        .find(target.query)
        .project({
          stockReserved: 1,
          stockCommitted: 1,
          stockReleased: 1,
          stockReservation: 1,
        })
        .toArray();
      let released = 0;
      for (const order of orders) {
        if (await releaseOrderStock(mongoose, db, order)) released += 1;
      }
      if (released) console.log(`orders: released ${released} stock reservation(s)`);
    }

    const result = await collection.deleteMany(target.query);
    console.log(`${target.collection}: deleted ${result.deletedCount}`);
  }

  console.log("\nCleanup complete.\n");
  await disconnect();
}

main().catch(async (err) => {
  console.error(`cleanup failed: ${err?.message || String(err)}`);
  await disconnect();
  process.exit(1);
});
