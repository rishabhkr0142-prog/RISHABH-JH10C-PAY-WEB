import mongoose from "mongoose";

/**
 * MongoDB connection helper using Mongoose.
 * Reuses a cached connection across dev hot-reloads and serverless function runs.
 * Reads MONGODB_URI from process.env.
 */

let cached = global._mongooseCache;

if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env.local"
    );
  }

  // Re-use cached active connection
  if (cached.conn) {
    return cached.conn;
  }

  // Re-use active connection promise
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    console.error("❌ MongoDB connection failed:", err?.message || err);
    throw err;
  }

  return cached.conn;
}

export default connectDB;

