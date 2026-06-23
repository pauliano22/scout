import { NextResponse } from 'next/server'

// ─── Types ───────────────────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number   // Unix timestamp (seconds) when the window resets
  timeWindow: number // Window duration in seconds
}

export type Tier = 'public' | 'authenticated' | 'admin'

// ─── Tier configuration ──────────────────────────────────────────────────

const TIER_CONFIGS: Record<Tier, { limit: number; windowMs: number }> = {
  public: { limit: 30, windowMs: 60_000 },           // 30 req / 1 min
  authenticated: { limit: 100, windowMs: 60_000 },    // 100 req / 1 min
  admin: { limit: 300, windowMs: 60_000 },            // 300 req / 1 min
}

// ─── In-memory sliding window store ──────────────────────────────────────

/** Map<identifier, timestamp[]> — each entry is the request timestamps for a client. */
const store = new Map<string, number[]>()

/** Last cleanup timestamp to avoid O(store) scans on every request. */
let lastCleanup = Date.now()

/**
 * Prune stale entries that have fallen out of the max sliding window plus
 * a grace period. Runs at most once per 60 seconds to keep the map bounded.
 */
function prune(): void {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now

  const maxWindow = Math.max(
    ...Object.values(TIER_CONFIGS).map((c) => c.windowMs),
  )
  const cutoff = now - maxWindow * 2 // keep 2× the longest window

  for (const [key, timestamps] of store) {
    const fresh = timestamps.filter((t) => t > cutoff)
    if (fresh.length === 0) {
      store.delete(key)
    } else if (fresh.length < timestamps.length) {
      store.set(key, fresh)
    }
  }
}

/**
 * Check whether `identifier` is allowed to make a request at the given `tier`.
 *
 * - On success: records the request timestamp and returns `{ success: true }`
 *   with remaining count and window metadata.
 * - On rate-limit hit: returns `{ success: false }` with remaining=0.
 *
 * The function is **not** async — it's pure synchronous in-memory logic so it
 * adds negligible latency to the hot path.
 */
export function checkRateLimit(
  identifier: string,
  tier: Tier = 'public',
): RateLimitResult {
  prune()

  const now = Date.now()
  const config = TIER_CONFIGS[tier]
  const { limit, windowMs } = config

  let timestamps = store.get(identifier) ?? []

  // Slide the window: discard timestamps outside the current window
  const cutoff = now - windowMs
  timestamps = timestamps.filter((t) => t > cutoff)

  if (timestamps.length >= limit) {
    // Rate limit hit — compute reset time from the oldest surviving timestamp
    const oldest = timestamps[0]
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil((oldest + windowMs) / 1000),
      timeWindow: Math.ceil(windowMs / 1000),
    }
  }

  // Record this request
  timestamps.push(now)
  store.set(identifier, timestamps)

  const remaining = limit - timestamps.length
  const reset =
    timestamps.length > 1
      ? Math.ceil((timestamps[0] + windowMs) / 1000)
      : Math.ceil((now + windowMs) / 1000)

  return {
    success: true,
    limit,
    remaining,
    reset,
    timeWindow: Math.ceil(windowMs / 1000),
  }
}

/**
 * Attach standard rate-limit headers to an existing response.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  response.headers.set('X-RateLimit-Reset', String(result.reset))
  return response
}

/**
 * Build a 429 response with Retry-After and rate-limit headers.
 *
 * The body is a clean JSON object: `{ error: "..." }` for easy client parsing.
 */
export function rateLimitExceeded(result: RateLimitResult): NextResponse {
  const response = NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429 },
  )
  response.headers.set('Retry-After', String(result.timeWindow))
  addRateLimitHeaders(response, result)
  return response
}

// ─── IP extraction helpers ───────────────────────────────────────────────

/**
 * Extract the client IP from a NextRequest, falling back to headers set by
 * common reverse-proxies / edge platforms (Vercel, Cloudflare, etc.).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    '127.0.0.1'
  )
}
