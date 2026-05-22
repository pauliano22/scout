import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const VALID_STATUSES = new Set([
  'saved',
  'message_drafted',
  'contacted',
  'replied',
  'meeting_set',
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const authHeader = request.headers.get('Authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: { user }, error: authError } = await serviceClient.auth.getUser(accessToken)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if ('status' in body) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
    if (body.status === 'contacted') {
      updates.contacted = true
      updates.contacted_at = new Date().toISOString()
    }
  }

  if ('notes' in body) {
    if (body.notes !== null && typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'Invalid notes' }, { status: 400 })
    }
    updates.notes = body.notes
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await serviceClient
    .from('user_networks')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id) // ownership check via filter, not separate query
    .select('id, status, notes, contacted, contacted_at')
    .single()

  if (error) {
    console.error('[network/patch] error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
