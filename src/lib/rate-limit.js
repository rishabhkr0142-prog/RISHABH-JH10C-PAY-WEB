/**
 * Lightweight in-memory rate limiter for serverless Next.js route handlers.
 * Prunes expired hits automatically to avoid memory leaks.
 */

const tracker = new Map();

/**
 * Check and record a hit for a key (e.g. IP or userId).
 * @param {string} key - Identifier (IP, userId, etc.)
 * @param {number} limit - Maximum requests allowed in the window
 * @param {number} windowMs - Window duration in milliseconds (default 60s)
 * @returns {{ success: boolean, remaining: number, resetMs: number }}
 */
export function rateLimit(key, limit = 20, windowMs = 60 * 1000) {
  const now = Date.now();
  const record = tracker.get(key) || { count: 0, resetAt: now + windowMs };

  // If window expired, reset
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count += 1;
  tracker.set(key, record);

  // Periodically cleanup expired entries
  if (tracker.size > 2000) {
    for (const [k, v] of tracker.entries()) {
      if (now > v.resetAt) tracker.delete(k);
    }
  }

  const success = record.count <= limit;
  const remaining = Math.max(0, limit - record.count);
  const resetMs = Math.max(0, record.resetAt - now);

  return { success, remaining, resetMs };
}

