const { connect, disconnect } = require("./lib/db");

function indexOptionsMatch(index, options) {
  return (
    Boolean(index.unique) === Boolean(options.unique) &&
    (index.expireAfterSeconds ?? null) === (options.expireAfterSeconds ?? null) &&
    JSON.stringify(index.partialFilterExpression || null) ===
      JSON.stringify(options.partialFilterExpression || null)
  );
}

async function createIndex(db, collection, keys, options) {
  const label = `${collection}.${options.name}`;
  try {
    const indexes = await db.collection(collection).indexes();
    const wanted = JSON.stringify(keys);
    const sameKeys = indexes.filter(
      (index) => JSON.stringify(index.key) === wanted
    );
    const matching = sameKeys.find((index) => indexOptionsMatch(index, options));
    if (matching) {
      console.log(`OK   ${label} -> already exists as ${matching.name}`);
      return true;
    }
    if (sameKeys.length) {
      console.error(
        `FAIL ${label}: an index with the same keys already exists as ${sameKeys
          .map((index) => index.name)
          .join(", ")} but has different options.`
      );
      return false;
    }

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
  const { db, dbName } = await connect();
  console.log(`Connected to database: ${dbName}`);

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

  // Orders — only the indexes used by real query paths.
  results.push(
    await createIndex(
      db,
      "orders",
      { orderNo: 1 },
      {
        unique: true,
        partialFilterExpression: { orderNo: { $gt: "" } },
        name: "uniq_order_no",
      }
    )
  );
  results.push(
    await createIndex(
      db,
      "orders",
      { userId: 1, createdAt: -1 },
      { name: "idx_orders_user_created" }
    )
  );
  results.push(
    await createIndex(
      db,
      "orders",
      { discordId: 1, createdAt: -1 },
      { name: "idx_orders_discord_created" }
    )
  );
  results.push(
    await createIndex(
      db,
      "orders",
      { status: 1, createdAt: -1 },
      { name: "idx_orders_status_created" }
    )
  );
  results.push(
    await createIndex(
      db,
      "orders",
      { amountPaise: 1, status: 1, expiresAt: 1 },
      { name: "idx_orders_amount_status_expiry" }
    )
  );

  // Temporary audit logs expire after 7 days.
  results.push(
    await createIndex(
      db,
      "payment_logs",
      { createdAt: 1 },
      { expireAfterSeconds: 7 * 24 * 60 * 60, name: "ttl_payment_logs_7d" }
    )
  );
  results.push(
    await createIndex(
      db,
      "stock_logs",
      { createdAt: 1 },
      { expireAfterSeconds: 7 * 24 * 60 * 60, name: "ttl_stock_logs_7d" }
    )
  );

  await disconnect();

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
  await disconnect();
  process.exit(1);
});
