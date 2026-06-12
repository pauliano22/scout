// Resolves the calling user for routes that serve BOTH the web app (cookie
// session) and the mobile app (Authorization: Bearer <access_token>). Returns
// a Supabase client appropriate to the path: the cookie client (RLS) for web,
// or the service client for mobile — callers must scope every query by the
// returned userId.

import type { NextRequest } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Next.js patches global fetch and CACHES GETs — which silently serves stale
// PostgREST reads (a fresh user's empty queue stayed "empty" after inserts).
// Every supabase call from a route handler must opt out.
const noStoreFetch: typeof fetch = (url, init) => fetch(url, { ...init, cache: 'no-store' })

export function serviceClient(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, global: { fetch: noStoreFetch } },
  )
}

export interface RequestAuth {
  userId: string
  db: SupabaseClient
}

export async function resolveRequestUser(request: Request | NextRequest): Promise<RequestAuth | null> {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token) {
    const service = serviceClient()
    const { data: { user } } = await service.auth.getUser(token)
    return user ? { userId: user.id, db: service } : null
  }

  // Cookie path: the session only establishes IDENTITY. Work happens through
  // the service client (identical to the Bearer path) — several agent tables
  // (outreach_queue, networking_plans) are service-written by design, so an
  // RLS client here silently no-ops the picks engine. Every consumer of this
  // helper scopes every query by the returned userId.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { userId: user.id, db: serviceClient() } : null
}
