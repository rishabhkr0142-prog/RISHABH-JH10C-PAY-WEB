/**
 * Product image health checker.
 *
 * Usage:
 *   node scripts/check-product-images.js
 *
 * Connects to MongoDB using MONGODB_URI from .env.local / .env and checks every
 * product image URL (HTTP status, protocol, localhost / ephemeral paths).
 * Prints a list of products whose image link is broken so they can be re-uploaded.
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

const ProductSchema = new mongoose.Schema({}, { strict: false, collection: "products" });
const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);

function classifyUrl(raw) {
  if (!raw || !String(raw).trim()) return { ok: false, reason: "empty" };
  const url = String(raw).trim();
  if (url.startsWith("/")) {
    if (url.startsWith("/uploads/") || url.includes("public/uploads")) {
      return { ok: false, reason: "local filesystem path (not persistent on Vercel)" };
    }
    return { ok: true, reason: "local static asset" };
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  if (parsed.protocol === "http:") {
    return { ok: false, reason: "http:// (mixed content on https site)" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: `unsupported protocol ${parsed.protocol}` };
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
    return { ok: false, reason: "localhost URL" };
  }
  if (host === "cdn.discordapp.com" || host === "media.discordapp.net") {
    return { ok: false, reason: "Discord CDN link (can expire / requires signed params)" };
  }
  return { ok: true, reason: "remote https" };
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProductImageCheck/1.0)" },
    });
    if (res.status === 405 || res.status === 403 || res.status === 400) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ProductImageCheck/1.0)",
          Range: "bytes=0-0",
        },
      });
    }
    return { status: res.status, ok: res.ok };
  } catch (err) {
    return { status: 0, ok: false, error: err.name === "AbortError" ? "timeout" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    dbName: resolveDbName(MONGODB_URI),
  });
  const products = await Product.find({}).lean();
  console.log(`Found ${products.length} product(s).\n`);

  const broken = [];
  for (const product of products) {
    const urls = [];
    if (product.imageUrl) urls.push(product.imageUrl);
    if (Array.isArray(product.images)) urls.push(...product.images);
    const unique = [...new Set(urls.map((u) => String(u || "").trim()).filter(Boolean))];

    if (unique.length === 0) {
      broken.push({ product, url: "", reason: "no image URL" });
      continue;
    }

    for (const url of unique) {
      const cls = classifyUrl(url);
      const isRemote = url.startsWith("http://") || url.startsWith("https://");

      if (!isRemote) {
        if (!cls.ok) broken.push({ product, url, reason: cls.reason });
        continue;
      }

      const result = await probe(url);
      const httpReason = result.ok
        ? `HTTP ${result.status}`
        : `HTTP ${result.status || result.error || "error"}`;

      if (!cls.ok || !result.ok) {
        const reason = cls.ok ? httpReason : `${cls.reason} · ${httpReason}`;
        broken.push({ product, url, reason });
      }
    }
  }

  if (broken.length === 0) {
    console.log("All product images look reachable.");
  } else {
    console.log(`${broken.length} broken image reference(s):\n`);
    broken.forEach(({ product, url, reason }, i) => {
      console.log(`${i + 1}. ${product.name || "(unnamed)"}`);
      console.log(`   id:     ${String(product._id)}`);
      console.log(`   slug:   ${product.slug || "-"}`);
      console.log(`   image:  ${url || "(empty)"}`);
      console.log(`   reason: ${reason}\n`);
    });
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Image check failed:", err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
