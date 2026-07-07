// GET  /api/admin/security — list recent events and alerts with pagination
// PATCH /api/admin/security — acknowledge an alert (body: { alert_id })
//
// Requires admin session auth.
import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import type { SecurityEvent, SecurityAlert } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'

// ─── GET — list events or alerts ─────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()
    const searchParams = request.nextUrl.searchParams

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const offset = (page - 1) * limit
    const section = searchParams.get('section') ?? 'events'

    if (section === 'alerts') {
      const { data: alerts, count, error } = await db
        .from('security_alerts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      return ok({
        entries: (alerts ?? []) as SecurityAlert[],
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      })
    }

    const { data: events, count, error } = await db
      .from('security_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return ok({
      entries: (events ?? []) as SecurityEvent[],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}

// ─── PATCH — acknowledge an alert ─────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = serviceClient()

    let body: { alert_id?: string }
    try {
      body = await request.json()
    } catch {
      return fail('Invalid JSON body', 400)
    }

    if (!body.alert_id || typeof body.alert_id !== 'string') {
      return fail('alert_id is required', 400)
    }

    const { error } = await db
      .from('security_alerts')
      .update({
        acknowledged: true,
        acknowledged_by: ctx.userId,
      })
      .eq('id', body.alert_id)

    if (error) throw error

    return ok({ acknowledged: true, alert_id: body.alert_id })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
