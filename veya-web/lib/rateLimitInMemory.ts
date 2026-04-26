/**
 * Best-effort per-runtime rate limiting (single Node isolate).
 * On serverless, limits are not global across instances — still useful against casual abuse.
 */

const buckets = new Map<string, number[]>();

export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

/** Sliding window: returns true if this hit is allowed, false if over the limit. */
export function rateLimitAllow(key: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const prev = buckets.get(key) ?? [];
  const recent = prev.filter((t) => t > cutoff);
  if (recent.length >= maxHits) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}
