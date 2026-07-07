import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface CheckResult {
  status: 'ok' | 'error'
  error?: string
}

async function checkSupabase(): Promise<CheckResult> {
  try {
    const supabase = createClient()
    // Query a known table to verify DB connectivity.
    // If the table doesn't exist, we still proved the DB is reachable
    // (the error will be "relation does not exist", not a connection error).
    const { error } = await supabase.from('health_check').select('id').limit(1)
    if (error) {
      // A "relation does not exist" error means the DB is UP — the table just doesn't exist.
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        return { status: 'ok' }
      }
      // Any other error (connection refused, auth, etc.) is a real problem.
      return { status: 'error', error: error.message }
    }
    return { status: 'ok' }
  } catch (err: any) {
    return { status: 'error', error: err?.message || 'Unknown Supabase error' }
  }
}

async function checkSendGrid(): Promise<CheckResult> {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) {
    return { status: 'ok', error: 'SENDGRID_API_KEY not configured, skipped' }
  }
  try {
    // Lightweight check: call SendGrid's API to verify the key is valid
    const res = await fetch('https://api.sendgrid.com/v3/scopes', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    if (res.ok) {
      return { status: 'ok' }
    } else if (res.status === 401 || res.status === 403) {
      return { status: 'error', error: 'Invalid API key (401/403)' }
    } else {
      return { status: 'error', error: `Unexpected status: ${res.status}` }
    }
  } catch (err: any) {
    return { status: 'error', error: err?.message || 'SendGrid connection failed' }
  }
}

async function checkRedis(): Promise<CheckResult> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return { status: 'ok', error: 'REDIS_URL not configured, skipped' }
  }
  try {
    // Dynamic import so ioredis is only loaded when REDIS_URL is set
    const { default: Redis } = await import('ioredis')
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      retryStrategy() {
        return null // don't retry
      },
    })
    const pong = await redis.ping()
    await redis.quit().catch(() => {})
    if (pong === 'PONG') {
      return { status: 'ok' }
    }
    return { status: 'error', error: `Unexpected ping response: ${pong}` }
  } catch (err: any) {
    return { status: 'error', error: err?.message || 'Redis connection failed' }
  }
}

export async function GET() {
  const [supabase, sendgrid, redis] = await Promise.all([
    checkSupabase(),
    checkSendGrid(),
    checkRedis(),
  ])

  const checks = { supabase: supabase.status, sendgrid: sendgrid.status, redis: redis.status }
  const allOk = [supabase, sendgrid, redis].every((c) => c.status === 'ok')
  const statusCode = allOk ? 200 : 503

  // Collect error details for failing checks
  const details: Record<string, { status: string; error?: string }> = {
    supabase,
    sendgrid,
    redis,
  }

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      checks,
      details,
      uptime: process.uptime(),
    },
    {
      status: statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  )
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  )
}
