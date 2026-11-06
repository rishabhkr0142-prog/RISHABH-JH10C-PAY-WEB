/**
 * One-time migration: Mark existing orders as already notified for Discord New Sale webhook.
 *
 * Prevents webhook spam for all past completed/paid orders when the Discord
 * webhook URL is first configured and activated in Admin Settings.
 *
 * Usage:
 *   npm run migrate:sale-notifications
 *   node scripts/migrate-sale-notifications.js
 */

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

function loadEnvironment() {
  const rootDir = path.resolve(__dirname, "..");
  for (const fileName of [".env.local", ".env"]) {
    const fullPath = path.join(rootDir, fileName);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf-8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  }
}

loadEnvironment();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is not defined in .env or .env.local");
  process.exit(1);
}

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10000,
  });

  const ordersCollection = mongoose.connection.collection("orders");

  const totalOrders = await ordersCollection.countDocuments({});
  console.log(`Total orders found: ${totalOrders}`);

  // Mark all historical completed/paid orders as saleNotified: true so webhook is not triggered for them
  const resultCompleted = await ordersCollection.updateMany(
    {
      status: { $in: ["completed", "paid"] },
      saleNotified: { $ne: true },
    },
    {
      $set: {
        saleNotified: true,
        notifiedAt: new Date(),
        notifyError: "",
      },
    }
  );

  console.log(
    `Marked ${resultCompleted.modifiedCount} existing completed/paid orders as saleNotified: true`
  );

  // For any other orders missing the field entirely, default to false
  const resultRemaining = await ordersCollection.updateMany(
    {
      saleNotified: { $exists: false },
    },
    {
      $set: {
        saleNotified: false,
        notifiedAt: null,
        notifyError: "",
      },
    }
  );

  console.log(
    `Initialized ${resultRemaining.modifiedCount} pending/cancelled orders with saleNotified: false`
  );

  // Create compound index for fast queries & atomic locking
  try {
    await ordersCollection.createIndex(
      { status: 1, saleNotified: 1 },
      { background: true, name: "status_1_saleNotified_1" }
    );
    console.log("Ensured index on { status: 1, saleNotified: 1 }");
  } catch (idxErr) {
    console.warn("Index creation warning:", idxErr.message);
  }

  console.log("Sale notification migration completed successfully.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

