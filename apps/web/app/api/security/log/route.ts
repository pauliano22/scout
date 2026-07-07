// POST /api/security/log — logs a security event.
// Authenticated via internal API key header (x-api-key matching INTERNAL_API_KEY env var).
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const key = process.env.INTERNAL_API_KEY
  if (!key) return false
  return req.headers.get('x-api-key') === key
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    event_type?: string
    severity?: string
    source_ip?: string
    user_id?: string | null
    details?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.event_type || typeof body.event_type !== 'string') {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 })
  }
  if (!body.severity || !['info', 'warning', 'critical'].includes(body.severity)) {
    return NextResponse.json({ error: 'severity must be info, warning, or critical' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    global: { fetch: (url: any, init: any) => fetch(url, { ...init, cache: 'no-store' }) },
  })

  const { data, error } = await supabase
    .from('security_events')
    .insert({
      event_type: body.event_type,
      severity: body.severity,
      source_ip: body.source_ip ?? null,
      user_id: body.user_id ?? null,
      details: body.details ?? {},
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, error: null })
}
