const { connect, disconnect, formatBytes } = require("./lib/db");

/**
 * Storage report for the current MongoDB database.
 * Usage: node scripts/db-report.js
 *
 * Prints per-collection document count, data size, index size, and the largest
 * documents so you can see where the 512 MB Atlas free tier is being used.
 */

function pad(value, width) {
  return String(value).padEnd(width, " ");
}

async function collectionReport(db, collectionName) {
  const collection = db.collection(collectionName);

  const count = await collection.countDocuments().catch(() => 0);

  let stats = {};
  try {
    stats = await db.command({ collStats: collectionName });
  } catch {
    stats = {};
  }

  let indexes = [];
  try {
    indexes = await collection.indexes();
  } catch {
    indexes = [];
  }

  let largest = [];
  if (count > 0) {
    try {
      largest = await collection
        .aggregate([
          { $project: { size: { $bsonSize: "$$ROOT" }, name: 1, orderNo: 1, username: 1, slug: 1 } },
          { $sort: { size: -1 } },
          { $limit: 5 },
        ])
        .toArray();
    } catch {
      largest = [];
    }
  }

  return {
    name: collectionName,
    count,
    size: Number(stats.size) || 0,
    storageSize: Number(stats.storageSize) || 0,
    indexSize: Number(stats.totalIndexSize) || 0,
    indexes: indexes.length,
    largest,
  };
}

async function run() {
  const { db, dbName } = await connect();
  console.log(`\nMongoDB database: ${dbName}\n`);

  const infos = await db.listCollections().toArray();
  const names = infos
    .filter((info) => info.type !== "view")
    .map((info) => info.name)
    .sort();

  const reports = [];
  for (const name of names) {
    reports.push(await collectionReport(db, name));
  }

  reports.sort((a, b) => b.size - a.size);

  console.log(
    `${pad("Collection", 26)} ${pad("Docs", 10)} ${pad("Data", 12)} ${pad("Storage", 12)} ${pad("Indexes", 10)}`
  );
  console.log("-".repeat(78));

  let totalDocs = 0;
  let totalSize = 0;
  let totalStorage = 0;
  let totalIndex = 0;

  for (const report of reports) {
    totalDocs += report.count;
    totalSize += report.size;
    totalStorage += report.storageSize;
    totalIndex += report.indexSize;

    console.log(
      `${pad(report.name, 26)} ${pad(report.count, 10)} ${pad(formatBytes(report.size), 12)} ${pad(formatBytes(report.storageSize), 12)} ${pad(formatBytes(report.indexSize), 10)}`
    );
  }

  console.log("-".repeat(78));
  console.log(
    `${pad("TOTAL", 26)} ${pad(totalDocs, 10)} ${pad(formatBytes(totalSize), 12)} ${pad(formatBytes(totalStorage), 12)} ${pad(formatBytes(totalIndex), 10)}`
  );

  console.log("\nLargest documents per collection:\n");
  for (const report of reports) {
    if (report.largest.length === 0) continue;
    console.log(`${report.name}:`);
    for (const doc of report.largest) {
      const label =
        doc.orderNo || doc.name || doc.slug || doc.username || String(doc._id);
      console.log(`  - ${formatBytes(doc.size)}  ${label}`);
    }
  }

  console.log(
    "\nTip: images should only be stored as Cloudinary URLs + public ids. Run scripts/migrate-image-data.js to find inline base64 image payloads.\n"
  );

  await disconnect();
}

run().catch(async (err) => {
  console.error(`db-report failed: ${err?.message || String(err)}`);
  await disconnect();
  process.exit(1);
});
