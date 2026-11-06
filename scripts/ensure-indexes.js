const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.resolve(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const key = match[1];
      if (process.env[key] !== undefined) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value.replace(/\\n/g, "\n");
    }
  }
}

loadEnv();

async function createIndex(db, collection, keys, options) {
  const label = `${collection}.${options.name}`;
  try {
    const name = await db.collection(collection).createIndex(keys, options);
    console.log(`OK   ${label} -> ${name}`);
    return true;
  } catch (err) {
    console.error(`FAIL ${label}: ${err?.message || String(err)}`);
    return false;
  }
}

async function hasUniqueIndex(db, collection, field) {
  try {
    const indexes = await db.collection(collection).indexes();
    return indexes.some(
      (index) =>
        index.unique &&
        Object.keys(index.key || {}).length === 1 &&
        index.key[field] === 1
    );
  } catch {
    return false;
  }
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI must be set in .env");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;

  const results = [];

  if (await hasUniqueIndex(db, "payments", "utr")) {
    console.log("OK   payments.utr already has a unique index");
    results.push(true);
  } else {
    results.push(
      await createIndex(
        db,
        "payments",
        { utr: 1 },
        { unique: true, name: "uniq_payment_utr" }
      )
    );
  }

  results.push(
    await createIndex(
      db,
      "payments",
      { txnId: 1 },
      {
        unique: true,
        partialFilterExpression: { txnId: { $gt: "" } },
        name: "uniq_payment_txn_id_nonempty",
      }
    )
  );

  results.push(
    await createIndex(
      db,
      "idempotency_keys",
      { userId: 1, endpoint: 1, key: 1 },
      { unique: true, name: "uniq_idempotency_user_endpoint_key" }
    )
  );

  results.push(
    await createIndex(
      db,
      "idempotency_keys",
      { userId: 1, key: 1 },
      { name: "idx_idempotency_user_key" }
    )
  );

  results.push(
    await createIndex(
      db,
      "idempotency_keys",
      { createdAt: 1 },
      { expireAfterSeconds: 48 * 60 * 60, name: "ttl_idempotency_48h" }
    )
  );

  results.push(
    await createIndex(
      db,
      "idempotency_keys",
      { status: 1, lockedAt: 1 },
      { name: "idx_idempotency_processing_locked" }
    )
  );

  await mongoose.disconnect();

  if (results.some((ok) => !ok)) {
    console.error(
      "One or more indexes failed. Remove duplicate data before retrying."
    );
    process.exitCode = 1;
  } else {
    console.log("All required indexes are present.");
  }
}

run().catch(async (err) => {
  console.error(`Index migration failed: ${err?.message || String(err)}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
