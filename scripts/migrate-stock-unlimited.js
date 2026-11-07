/**
 * One-time inventory migration.
 *
 * Usage:
 *   npm run migrate:stock
 *   node scripts/migrate-stock-unlimited.js
 *
 * Sets stockMode "unlimited" only on products/plans that do not already have a
 * valid mode. Existing "limited" settings are never overwritten, so the script
 * is safe to run more than once.
 */

const mongoose = require("mongoose");
const { resolveDbName } = require("./lib/db");
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

const VALID_MODES = new Set(["unlimited", "limited"]);

function normalizeMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return VALID_MODES.has(mode) ? mode : "unlimited";
}

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10000,
    dbName: resolveDbName(MONGODB_URI),
  });

  const collection = mongoose.connection.collection("products");
  const cursor = collection.find({});
  let scanned = 0;
  let updated = 0;

  while (await cursor.hasNext()) {
    const product = await cursor.next();
    scanned += 1;

    const updates = {};

    if (!VALID_MODES.has(String(product.stockMode || "").toLowerCase())) {
      updates.stockMode = "unlimited";
    }
    if (product.outOfStock === undefined || product.outOfStock === null) {
      updates.outOfStock = false;
    }
    if (!Number.isFinite(Number(product.reserved))) {
      updates.reserved = 0;
    }

    let plansChanged = false;
    const plans = Array.isArray(product.plans) ? product.plans : [];
    const nextPlans = plans.map((plan) => {
      const next = { ...plan };
      if (!VALID_MODES.has(String(plan.stockMode || "").toLowerCase())) {
        next.stockMode = "unlimited";
        plansChanged = true;
      }
      if (plan.outOfStock === undefined || plan.outOfStock === null) {
        next.outOfStock = false;
        plansChanged = true;
      }
      if (!Number.isFinite(Number(plan.reserved))) {
        next.reserved = 0;
        plansChanged = true;
      }
      return next;
    });

    if (plansChanged) updates.plans = nextPlans;

    if (Object.keys(updates).length > 0) {
      await collection.updateOne({ _id: product._id }, { $set: updates });
      updated += 1;
    }
  }

  console.log(`Scanned ${scanned} product(s); updated ${updated}.`);
  console.log("All legacy products/plans without a mode are now Unlimited.");
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Inventory migration failed:", err);
  try {
    await mongoose.disconnect();
  } catch (e) {}
  process.exit(1);
});
