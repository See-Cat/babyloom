const WINDOW_MS = 60_000;
const MAX_REPORTS = 60;

const buckets = new Map<string, { count: number; windowStart: number }>();

export function takeClientLogToken(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= MAX_REPORTS) return false;
  bucket.count += 1;
  return true;
}

export function resetClientLogRateLimitForTesting() {
  buckets.clear();
}
