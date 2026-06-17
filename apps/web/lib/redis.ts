import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL

let redis: Redis | null = null
let redisError: Error | null = null

/**
 * Returns a Redis client instance connected to REDIS_URL, or null if
 * REDIS_URL is not set or the connection fails. Callers should always
 * check the return value before use.
 */
export function getRedis(): Redis | null {
  if (redis !== null) return redis
  if (redisError) return null

  // If REDIS_URL is not set, gracefully disable caching — no-op, no crash.
  if (!REDIS_URL) {
    redisError = new Error('REDIS_URL not configured, caching disabled')
    return null
  }

  try {
    redis = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null // give up after 3 retries
        return Math.min(times * 200, 1000)
      },
    })

    // Attach a one-shot error handler so connection failures don't crash the
    // process — we log and fall back to the DB.
    redis.on('error', (err) => {
      console.warn('[redis] Connection error — falling back to DB query:', err.message)
    })

    return redis
  } catch (err) {
    redisError = err instanceof Error ? err : new Error(String(err))
    console.warn('[redis] Failed to create client — caching disabled:', redisError.message)
    return null
  }
}

/**
 * Attempt to ping the Redis server to verify connectivity.
 * Returns true if connected, false otherwise.
 */
export async function isRedisConnected(): Promise<boolean> {
  const client = getRedis()
  if (!client) return false
  try {
    await client.ping()
    return true
  } catch {
    return false
  }
}

/**
 * Build a deterministic cache key from search params.
 * All params are normalised and sorted so identical requests always
 * produce the same key regardless of param order.
 */
export function buildAlumniSearchCacheKey(params: Record<string, string | number | boolean | undefined>): string {
  const sorted: Record<string, string> = {}
  for (const key of Object.keys(params).sort()) {
    const val = params[key]
    if (val !== undefined && val !== '' && val !== 'All') {
      sorted[key] = String(val)
    }
  }
  return `search:redis:alumni:search:${JSON.stringify(sorted)}`
}
