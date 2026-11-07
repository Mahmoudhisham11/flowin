import { HttpError } from './serverAuth'

// Best-effort in-memory limiter (per server instance). It stops accidental floods and
// casual abuse; use a shared store (Redis/Upstash) if hard guarantees are needed.
const buckets = new Map()

export function rateLimit(key, limit = 20, windowMs = 60_000) {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
  } else {
    entry.count += 1
    if (entry.count > limit) {
      throw new HttpError(429, 'Too many requests. Please slow down and try again shortly.')
    }
  }

  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k)
    }
  }
}
