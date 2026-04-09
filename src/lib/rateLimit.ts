// Simple in-memory rate limiter
// Works per-process — good for single-instance deploys (Vercel hobby, self-hosted)
// For multi-instance, replace with Redis (Upstash)

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Clean up expired entries periodically to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.resetAt < now) store.delete(key);
  }
}, 60_000);

/**
 * Returns true if the request should be blocked.
 * @param key      — e.g. userId or IP
 * @param limit    — max requests allowed in the window
 * @param windowMs — window duration in milliseconds
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  if (bucket.count > limit) return true;
  return false;
}
