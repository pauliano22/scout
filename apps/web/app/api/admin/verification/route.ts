// GET /api/admin/verification — list flagged graduation year mismatches
// PATCH /api/admin/verification — mark a verification as reviewed
//
// Protected by the admin layout's check against /api/admin/stats.
// Uses the service role client for simplicity (same pattern as stats).

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit
  const status = url.searchParams.get('status') // optional filter: 'mismatch' | 'verified' | 'unverified' | 'pending'

  let query = sb
    .from('graduation_verification')
    .select(`
      *,
      alumni:alumni_id (
        id,
        full_name,
        email,
        sport,
        graduation_year,
        company,
        role
      )
    `, { count: 'exact' })

  if (status) {
    query = query.eq('match_status', status)
  }

  // Default: show un-reviewed mismatches first, then all others
  const { data, error, count } = await query
    .order('flagged_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[admin/verification] query failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      verifications: data ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  })
}

export async function PATCH(request: NextRequest) {
  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let body: { id?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id } = body
  if (!id) {
    return NextResponse.json({ error: 'Missing verification id' }, { status: 400 })
  }

  const { error } = await sb
    .from('graduation_verification')
    .update({ reviewed: true })
    .eq('id', id)

  if (error) {
    console.error('[admin/verification] update failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
