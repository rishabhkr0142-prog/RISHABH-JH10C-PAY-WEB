import mongoose from "mongoose";

/**
 * IdempotencyKey — one row per (user, endpoint, key) request attempt.
 *
 * Status lifecycle:
 *   processing -> completed  (saved response is replayed for duplicate keys)
 *   processing -> failed     (client may retry with the same key)
 *
 * Rows expire automatically 48 hours after creation via the TTL index.
 */
const IdempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      default: "POST /api/orders",
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
      index: true,
    },
    // Hash of the request body so an idempotency key cannot be reused for a
    // different payload after it has completed.
    requestHash: { type: String, default: "" },
    responseStatus: { type: Number, default: 200 },
    response: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: "", maxlength: 500 },
    lockedAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "idempotency_keys" }
);

// Scoped to user + endpoint. A UUID key from one endpoint cannot collide with
// the same key on another endpoint for the same user.
IdempotencyKeySchema.index(
  { userId: 1, endpoint: 1, key: 1 },
  { unique: true, name: "uniq_idempotency_user_endpoint_key" }
);

// Also keep a plain (userId, key) lookup index for diagnostics/auditing.
IdempotencyKeySchema.index(
  { userId: 1, key: 1 },
  { name: "idx_idempotency_user_key" }
);

// TTL: automatically remove keys after 48 hours.
IdempotencyKeySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 48 * 60 * 60, name: "ttl_idempotency_48h" }
);

// Fast sweep for requests stuck in "processing".
IdempotencyKeySchema.index(
  { status: 1, lockedAt: 1 },
  { name: "idx_idempotency_processing_locked" }
);

export default mongoose.models.IdempotencyKey ||
  mongoose.model("IdempotencyKey", IdempotencyKeySchema);
