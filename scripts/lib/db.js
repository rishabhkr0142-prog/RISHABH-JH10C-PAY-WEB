const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const DEFAULT_DB_NAME = "rishabh_jh10c";

/** Load .env.local / .env without depending on dotenv. */
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

/** Resolve the database name exactly like src/lib/mongodb.js. */
function resolveDbName(uri) {
  const override = String(process.env.MONGODB_DB_NAME || "").trim();
  if (override) return override;

  const raw = String(uri || "").trim();
  if (!raw) return DEFAULT_DB_NAME;

  const match = raw.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
  if (match && match[1]) {
    const name = decodeURIComponent(match[1]).split("/")[0].trim();
    if (name) return name;
  }

  try {
    const parsed = new URL(raw);
    const name = decodeURIComponent(parsed.pathname || "")
      .replace(/^\//, "")
      .split("/")[0]
      .trim();
    if (name) return name;
  } catch {
    // ignore
  }

  return DEFAULT_DB_NAME;
}

async function connect() {
  loadEnv();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI must be set in .env or the environment.");
  }

  const dbName = resolveDbName(uri);
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 5,
  });

  return { mongoose, db: mongoose.connection.db, dbName };
}

async function disconnect() {
  await mongoose.disconnect().catch(() => {});
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

module.exports = {
  DEFAULT_DB_NAME,
  loadEnv,
  resolveDbName,
  connect,
  disconnect,
  formatBytes,
};
