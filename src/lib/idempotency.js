import crypto from "crypto";
import connectDB from "@/lib/db";
import IdempotencyKey from "@/models/IdempotencyKey";

/**
 * MongoDB-backed idempotency helper.
 *
 * A unique (userId, endpoint, key) index makes only one concurrent request the
 * owner of a key. Completed rows replay their saved response; processing rows
 * reject duplicates with 409; failed or stale-processing rows can be retried.
 */

export const IDEMPOTENCY_STUCK_MS = 5 * 60 * 1000;
const IDEMPOTENCY_TTL_SECONDS = 48 * 60 * 60;

let lastCleanupAt = 0;

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

/** Deterministic SHA-256 hash of a request body. */
export function hashRequestBody(body) {
  return crypto
    .createHash("sha256")
    .update(stableStringify(body ?? {}))
    .digest("hex");
}

/**
 * Mark keys stuck in "processing" for more than 5 minutes as failed so the
 * client can retry them. Returns the number of rows recovered.
 */
export async function cleanupStuckIdempotencyKeys() {
  await connectDB();
  const cutoff = new Date(Date.now() - IDEMPOTENCY_STUCK_MS);
  try {
    const result = await IdempotencyKey.updateMany(
      { status: "processing", lockedAt: { $lte: cutoff } },
      {
        $set: {
          status: "failed",
          error: "Processing timed out; safe to retry.",
          failedAt: new Date(),
        },
      }
    );
    return Number(result.modifiedCount) || 0;
  } catch (err) {
    console.error(
      "Idempotency cleanup failed:",
      err?.message || String(err)
    );
    return 0;
  }
}

async function maybeCleanupStuckKeys() {
  if (Date.now() - lastCleanupAt < 60 * 1000) return;
  lastCleanupAt = Date.now();
  await cleanupStuckIdempotencyKeys();
}

/**
 * Attempt to acquire an idempotency key.
 *
 * Returns one of:
 *   { mode: "none" }                              — no key supplied
 *   { mode: "new", id }                           — caller owns the key
 *   { mode: "replay", status, response }          — completed duplicate
 *   { mode: "conflict", status, error }           — processing or mismatch
 */
export async function beginIdempotency({
  userId,
  endpoint = "POST /api/orders",
  key,
  requestHash = "",
}) {
  const cleanKey = String(key || "").trim();
  if (!cleanKey) return { mode: "none" };

  await connectDB();
  await maybeCleanupStuckKeys();

  const ownerId = String(userId || "");
  const scope = String(endpoint || "POST /api/orders");
  const hash = String(requestHash || "");
  const staleCutoff = new Date(Date.now() - IDEMPOTENCY_STUCK_MS);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = await IdempotencyKey.create({
        key: cleanKey,
        userId: ownerId,
        endpoint: scope,
        status: "processing",
        requestHash: hash,
        lockedAt: new Date(),
      });
      return { mode: "new", id: String(created._id) };
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }

    const existing = await IdempotencyKey.findOne({
      userId: ownerId,
      endpoint: scope,
      key: cleanKey,
    }).lean();

    if (!existing) continue;

    if (existing.status === "completed") {
      if (hash && existing.requestHash && hash !== existing.requestHash) {
        return {
          mode: "conflict",
          status: 409,
          error:
            "This Idempotency-Key was already used with a different request body.",
        };
      }
      return {
        mode: "replay",
        status: Number(existing.responseStatus) || 200,
        response: existing.response,
      };
    }

    if (existing.status === "failed") {
      const claimed = await IdempotencyKey.findOneAndUpdate(
        { _id: existing._id, status: "failed" },
        {
          $set: {
            status: "processing",
            requestHash: hash,
            response: null,
            responseStatus: 200,
            error: "",
            lockedAt: new Date(),
            completedAt: null,
            failedAt: null,
          },
        },
        { new: true }
      ).lean();

      if (claimed) return { mode: "new", id: String(claimed._id) };
      continue;
    }

    // Existing key is processing. Reclaim only if its lock is older than 5m.
    const claimed = await IdempotencyKey.findOneAndUpdate(
      {
        _id: existing._id,
        status: "processing",
        lockedAt: { $lte: staleCutoff },
      },
      {
        $set: {
          requestHash: hash,
          response: null,
          responseStatus: 200,
          error: "",
          lockedAt: new Date(),
          completedAt: null,
          failedAt: null,
        },
      },
      { new: true }
    ).lean();

    if (claimed) return { mode: "new", id: String(claimed._id) };

    return {
      mode: "conflict",
      status: 409,
      error:
        "A request with this Idempotency-Key is already processing. Please wait and retry.",
    };
  }

  return {
    mode: "conflict",
    status: 409,
    error: "Could not acquire this Idempotency-Key. Please retry.",
  };
}

/** Persist the successful response so duplicate requests can replay it. */
export async function completeIdempotency(id, response, status = 200) {
  if (!id) return false;
  try {
    await connectDB();
    const now = new Date();
    await IdempotencyKey.updateOne(
      { _id: id, status: "processing" },
      {
        $set: {
          status: "completed",
          response: response ?? null,
          responseStatus: Number(status) || 200,
          completedAt: now,
          lockedAt: now,
          error: "",
          failedAt: null,
        },
      }
    );
    return true;
  } catch (err) {
    // Never fail an already-successful order because the replay record failed.
    console.error(
      "Idempotency completion failed:",
      err?.message || String(err)
    );
    return false;
  }
}

/** Release a key after validation/error so the client can safely retry. */
export async function failIdempotency(id, error = "") {
  if (!id) return false;
  try {
    await connectDB();
    await IdempotencyKey.updateOne(
      { _id: id, status: "processing" },
      {
        $set: {
          status: "failed",
          response: null,
          error: String(error || "Request failed").slice(0, 500),
          failedAt: new Date(),
        },
      }
    );
    return true;
  } catch (err) {
    console.error(
      "Idempotency failure marker could not be written:",
      err?.message || String(err)
    );
    return false;
  }
}

/** Exposed for diagnostics/tests. TTL is handled by MongoDB. */
export const IDEMPOTENCY_TTL = IDEMPOTENCY_TTL_SECONDS;
