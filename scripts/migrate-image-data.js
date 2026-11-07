const { connect, disconnect } = require("./lib/db");

/**
 * Find and remove inline image payloads (base64 / data: URLs) from MongoDB.
 * Image files must live in Cloudinary; MongoDB should only contain secure URLs
 * and public ids.
 *
 * Usage:
 *   node scripts/migrate-image-data.js            # DRY RUN
 *   node scripts/migrate-image-data.js --confirm  # apply changes
 */

const CONFIRM = process.argv.slice(2).includes("--confirm");

const INLINE_RE = /^\s*data:/i;
const IMAGE_FIELDS = ["imageUrl", "image", "avatar", "googlePicture"];

function isInlineImageValue(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (INLINE_RE.test(trimmed)) return true;

  // Very long raw base64-like strings are not valid image URLs.
  if (trimmed.length > 5000 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    return true;
  }
  return false;
}

function cleanDoc(doc) {
  const updates = {};

  for (const field of IMAGE_FIELDS) {
    if (doc[field] !== undefined && isInlineImageValue(doc[field])) {
      updates[field] = "";
    }
  }

  if (Array.isArray(doc.images)) {
    const cleaned = doc.images.filter((item) => !isInlineImageValue(item));
    if (cleaned.length !== doc.images.length) {
      updates.images = cleaned;
      if (!updates.imageUrl && !doc.imageUrl && cleaned.length > 0) {
        updates.imageUrl = cleaned[0];
      }
    }
  }

  if (Array.isArray(doc.imageUrls)) {
    const cleaned = doc.imageUrls.filter((item) => !isInlineImageValue(item));
    if (cleaned.length !== doc.imageUrls.length) {
      updates.imageUrls = cleaned;
    }
  }

  if (updates.imageUrl === "" && Array.isArray(doc.images)) {
    const firstValid = doc.images.find((item) => !isInlineImageValue(item));
    if (firstValid) updates.imageUrl = firstValid;
  }

  return updates;
}

async function main() {
  const { db, dbName } = await connect();
  console.log(`\nDatabase: ${dbName}`);
  console.log(CONFIRM ? "MODE: CONFIRM (changes WILL be written)\n" : "MODE: DRY RUN (nothing will be changed)\n");

  const collections = (await db.listCollections().toArray())
    .filter((info) => info.type !== "view")
    .map((info) => info.name)
    .sort();

  let totalFound = 0;
  let totalUpdated = 0;

  for (const collectionName of collections) {
    const collection = db.collection(collectionName);

    const query = {
      $or: [
        { imageUrl: INLINE_RE },
        { image: INLINE_RE },
        { avatar: INLINE_RE },
        { googlePicture: INLINE_RE },
        { images: INLINE_RE },
        { imageUrls: INLINE_RE },
        { value: INLINE_RE },
      ],
    };

    const docs = await collection.find(query).toArray();
    if (docs.length === 0) continue;

    let collectionUpdated = 0;

    for (const doc of docs) {
      const updates = cleanDoc(doc);
      if (updates.value === undefined && typeof doc.value === "string" && isInlineImageValue(doc.value)) {
        updates.value = "";
      }

      if (Object.keys(updates).length === 0) continue;

      totalFound += 1;
      console.log(
        `[${collectionName}] ${String(doc._id)} -> ${Object.keys(updates).join(", ")}`
      );

      if (CONFIRM) {
        await collection.updateOne({ _id: doc._id }, { $set: updates });
        collectionUpdated += 1;
        totalUpdated += 1;
      }
    }

    if (collectionUpdated > 0) {
      console.log(`[${collectionName}] updated ${collectionUpdated} document(s)\n`);
    }
  }

  console.log(`\nFound ${totalFound} document(s) with inline image data.`);
  if (CONFIRM) {
    console.log(`Updated ${totalUpdated} document(s).`);
  } else {
    console.log("DRY RUN complete. Re-run with --confirm to remove the inline data.");
  }
  console.log("");

  await disconnect();
}

main().catch(async (err) => {
  console.error(`migrate-image-data failed: ${err?.message || String(err)}`);
  await disconnect();
  process.exit(1);
});
