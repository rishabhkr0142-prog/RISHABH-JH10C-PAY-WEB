import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";

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

const MONGODB_URI = process.env.MONGODB_URI;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const BASE_URL = (
  process.env.TEST_BASE_URL || "http://localhost:3000"
).replace(/\/$/, "");

if (!MONGODB_URI || !NEXTAUTH_SECRET) {
  console.error("MONGODB_URI and NEXTAUTH_SECRET must be set in .env");
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postOrder({ cookieName, token, body, key }) {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        Cookie: `${cookieName}=${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const payload = await response.json().catch(() => null);
    return {
      status: response.status,
      payload,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      status: 0,
      payload: null,
      error: err?.message || String(err),
      durationMs: Date.now() - started,
    };
  }
}

async function run() {
  const runId = `${Date.now().toString(36)}-${crypto
    .randomBytes(4)
    .toString("hex")}`;
  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const discordId = `${Date.now()}${String(
    crypto.randomInt(100000, 999999)
  )}`;
  const idempotencyKey = crypto.randomUUID();
  const notes = `idem-test-${runId}`;
  const email = `idem-test-${runId}@example.invalid`;
  const productSlug = `idem-test-${runId}`;

  let db = null;
  let orderCreated = false;

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    db = mongoose.connection.db;

    await db.collection("idempotency_keys").createIndex(
      { userId: 1, endpoint: 1, key: 1 },
      {
        unique: true,
        name: "uniq_idempotency_user_endpoint_key",
      }
    );

    const now = new Date();
    await db.collection("users").insertOne({
      _id: userId,
      discordId,
      username: `Idempotency Test ${runId}`,
      email,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });

    await db.collection("products").insertOne({
      _id: productId,
      name: `Idempotency Test Product ${runId}`,
      slug: productSlug,
      description: "Temporary product created by the idempotency test.",
      price: 499,
      stockMode: "limited",
      stock: 5,
      reserved: 0,
      outOfStock: false,
      active: true,
      available: true,
      useStockItems: false,
      plans: [],
      deliveryType: "content",
      deliveryTitle: "Test delivery",
      deliveryMessage: "Idempotency test delivery content.",
      category: "Test",
      images: [],
      features: [],
      createdAt: now,
      updatedAt: now,
    });

    const jwtModule = await import("next-auth/jwt");
    const encode = jwtModule.encode || jwtModule.default?.encode;
    assert(typeof encode === "function", "next-auth/jwt encode is unavailable.");

    const token = await encode({
      token: {
        sub: String(userId),
        dbId: String(userId),
        discordId,
        name: `Idempotency Test ${runId}`,
        email,
      },
      secret: NEXTAUTH_SECRET,
      maxAge: 60 * 60,
    });

    const secureCookies =
      BASE_URL.startsWith("https://") ||
      String(process.env.NEXTAUTH_URL || "").startsWith("https://") ||
      process.env.NEXTAUTH_USE_SECURE_COOKIES === "1";
    const cookieName = secureCookies
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";
    const body = {
      productId: String(productId),
      quantity: 1,
      notes,
    };

    console.log(`Sending 10 concurrent POST /api/orders to ${BASE_URL} ...`);
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        postOrder({
          cookieName,
          token,
          body,
          key: idempotencyKey,
        })
      )
    );

    const statuses = responses.reduce((counts, result) => {
      const key = String(result.status);
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});

    console.log("Response statuses:", statuses);
    for (const result of responses) {
      if (result.status === 0) {
        console.log(`Network error: ${result.error}`);
      }
    }

    const okResponses = responses.filter(
      (result) => result.status === 200 && result.payload?.orderId
    );
    const orderIds = new Set(okResponses.map((result) => result.payload.orderId));

    const orders = await db.collection("orders").find({ notes }).toArray();
    if (orders.length > 0) orderCreated = true;

    const idempotencyRows = await db
      .collection("idempotency_keys")
      .find({
        key: idempotencyKey,
        userId: String(userId),
        endpoint: "POST /api/orders",
      })
      .toArray();

    const product = await db.collection("products").findOne({ _id: productId });
    const stockLogCount = await db
      .collection("stock_logs")
      .countDocuments({ productId });

    assert(
      !responses.some((result) => result.status === 0),
      `Could not reach the app at ${BASE_URL}. Start it with "npm run dev" and retry.`
    );
    assert(
      !responses.some((result) => result.status >= 500),
      "At least one request returned a 5xx response."
    );
    assert(okResponses.length >= 1, "No request returned a successful order.");
    assert(
      orderIds.size <= 1,
      `Successful responses referenced ${orderIds.size} different orders.`
    );
    assert(
      orders.length === 1,
      `Expected exactly 1 order in MongoDB, found ${orders.length}.`
    );
    assert(
      idempotencyRows.length === 1,
      `Expected exactly 1 idempotency row, found ${idempotencyRows.length}.`
    );
    assert(
      idempotencyRows[0].status === "completed",
      `Expected idempotency status "completed", found "${idempotencyRows[0].status}".`
    );
    assert(product, "Test product disappeared during the test.");
    assert(
      Number(product.stock) === 4,
      `Expected stock 4 after one reservation, found ${product.stock}.`
    );
    assert(
      Number(product.reserved) === 1,
      `Expected reserved 1 after one reservation, found ${product.reserved}.`
    );
    assert(stockLogCount >= 1, "Expected a stock reservation log.");

    console.log("PASS: one order, one idempotency row, one stock reservation.");
  } finally {
    if (db) {
      try {
        await db.collection("orders").deleteMany({ notes });
        await db.collection("idempotency_keys").deleteMany({
          userId: String(userId),
        });
        await db.collection("stock_logs").deleteMany({ productId });
        await db.collection("products").deleteMany({ _id: productId });
        await db.collection("users").deleteMany({ _id: userId });
        if (orderCreated) {
          await db
            .collection("stats")
            .updateOne({ key: "global" }, { $inc: { orders: -1 } });
        }
      } catch (cleanupErr) {
        console.error(
          "Cleanup failed:",
          cleanupErr?.message || String(cleanupErr)
        );
      }
    }
    await mongoose.disconnect().catch(() => {});
  }
}

run().catch((err) => {
  console.error(`FAIL: ${err?.message || String(err)}`);
  process.exitCode = 1;
});
