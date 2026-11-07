/**
 * Copy all documents from one MongoDB database to another (same cluster).
 *
 * Usage:
 *   node scripts/migrate-db-name.js                    # dry run (default)
 *   node scripts/migrate-db-name.js --confirm          # copy test -> configured DB
 *   node scripts/migrate-db-name.js --source=test --target=rishabh_jh10c --confirm
 *
 * Documents are upserted by _id, so the script is safe to run more than once.
 * Indexes are NOT copied here; run `npm run db:indexes` afterwards.
 */

const { connect, disconnect } = require("./lib/db");

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const argValue = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : fallback;
};

const SOURCE_DB = argValue("source", "test");
const BATCH_SIZE = 500;

async function copyCollection(sourceDb, targetDb, name) {
  const source = sourceDb.collection(name);
  const target = targetDb.collection(name);

  const total = await source.countDocuments({});
  if (total === 0) {
    console.log(`- ${name}: 0 docs, skipped`);
    return { copied: 0, total: 0 };
  }

  if (!confirm) {
    console.log(`- ${name}: ${total} docs would be copied`);
    return { copied: 0, total };
  }

  const cursor = source.find({});
  let batch = [];
  let copied = 0;

  const flush = async () => {
    if (!batch.length) return;
    const operations = batch.map((doc) => ({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
    }));
    await target.bulkWrite(operations, { ordered: false });
    copied += batch.length;
    batch = [];
  };

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  console.log(`- ${name}: ${copied}/${total} docs copied`);
  return { copied, total };
}

async function run() {
  const { mongoose, dbName } = await connect();
  const targetDbName = argValue("target", dbName);

  if (SOURCE_DB === targetDbName) {
    throw new Error("Source and target database names are identical.");
  }

  const client = mongoose.connection.getClient();
  const sourceDb = client.db(SOURCE_DB);
  const targetDb = client.db(targetDbName);

  console.log(`Source database: ${SOURCE_DB}`);
  console.log(`Target database: ${targetDbName}`);
  console.log(confirm ? "Mode: CONFIRM (writing)" : "Mode: DRY RUN (no writes)");
  console.log("");

  const collections = (await sourceDb.listCollections().toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."))
    .sort();

  let totalDocs = 0;
  for (const name of collections) {
    const result = await copyCollection(sourceDb, targetDb, name);
    totalDocs += result.total;
  }

  console.log("");
  console.log(`Collections: ${collections.length}, documents: ${totalDocs}`);
  if (confirm) {
    console.log("Done. Next: npm run db:indexes");
  } else {
    console.log("Re-run with --confirm to copy the documents.");
  }

  await disconnect();
}

run().catch(async (err) => {
  console.error("Migration failed:", err?.message || err);
  await disconnect();
  process.exit(1);
});
