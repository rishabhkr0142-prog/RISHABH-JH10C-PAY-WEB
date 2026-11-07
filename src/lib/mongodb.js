import mongoose from "mongoose";

/**
 * MongoDB connection helper using Mongoose.
 * Reuses a cached connection across dev hot-reloads and serverless function runs.
 *
 * The database name is resolved explicitly so we never silently fall back to
 * MongoDB's default "test" database:
 *   1. MONGODB_DB_NAME env var (optional override)
 *   2. The database path inside MONGODB_URI (mongodb+srv://host/<db>)
 *   3. Project default: "rishabh_jh10c"
 */

const DEFAULT_DB_NAME = "rishabh_jh10c";

let cached = global._mongooseCache;

if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null, key: "" };
}

/** Extract the database name from a MongoDB connection string. */
export function resolveMongoDbName(uri) {
  const override = String(process.env.MONGODB_DB_NAME || "").trim();
  if (override) return override;

  const raw = String(uri || "").trim();
  if (!raw) return DEFAULT_DB_NAME;

  // Fast path: mongodb://host:port/dbName?options
  const match = raw.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
  if (match && match[1]) {
    const name = decodeURIComponent(match[1]).split("/")[0].trim();
    if (name) return name;
  }

  // Fallback for unusual URIs (new URL can reject mongodb+srv on old Node).
  try {
    const parsed = new URL(raw);
    const name = decodeURIComponent(parsed.pathname || "")
      .replace(/^\//, "")
      .split("/")[0]
      .trim();
    if (name) return name;
  } catch {
    // ignore and use the safe project default
  }

  return DEFAULT_DB_NAME;
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env.local"
    );
  }

  const dbName = resolveMongoDbName(uri);
  const cacheKey = `${uri}\u0000${dbName}`;

  // Re-use cached active connection
  if (cached.conn && cached.key === cacheKey) {
    return cached.conn;
  }

  if (!cached.promise || cached.key !== cacheKey) {
    cached.key = cacheKey;
    cached.conn = null;

    const opts = {
      dbName,
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 60000,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    cached.key = "";
    console.error("MongoDB connection failed:", err?.message || err);
    throw err;
  }

  return cached.conn;
}

export default connectDB;
