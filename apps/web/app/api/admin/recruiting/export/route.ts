// GET /api/admin/recruiting/export — CSV of the (filtered) worklist.
// alumni.email is never selected anywhere in the recruiting feature, so it
// cannot appear here; the export is CRM state, not contact data.

import { NextRequest, NextResponse } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { fail } from '@/lib/api/respond'
import { logSecurityEvent, currentRequestIp } from '@/lib/security/events'
import { loadRecruitingBundle, filterRows, sortRows } from '@/lib/recruiting/merge'

export const dynamic = 'force-dynamic'

const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = serviceClient()

    const sp = request.nextUrl.searchParams
    const bundle = await loadRecruitingBundle(db)
    const rows = sortRows(
      filterRows(bundle.rows, {
        search: sp.get('search') ?? '',
        team: sp.get('team') ?? '',
        year: sp.get('year') ?? '',
        stage: sp.get('stage') ?? 'all',
      }),
      'team',
      false,
    )

    logSecurityEvent({
      event_type: 'data_export',
      severity: 'info',
      source_ip: currentRequestIp(),
      user_id: ctx.userId,
      details: { endpoint: '/api/admin/recruiting/export', rows: rows.length },
    })

    const header = [
      'team', 'name', 'year', 'stage', 'captain', 'instagram', 'email', 'last_touch',
      'next_action', 'next_action_due', 'signed_up_at', 'activated', 'notes',
    ].join(',')
    const lines = rows.map(r =>
      [
        esc(r.team_key),
        esc(r.full_name),
        esc(r.graduation_year),
        esc(r.effective_stage),
        esc(r.crm?.is_captain ? 'yes' : ''),
        esc(r.crm?.instagram_handle ?? ''),
        esc(r.crm?.contact_email ?? ''),
        esc(r.last_activity?.occurred_at?.slice(0, 10) ?? ''),
        esc(r.crm?.next_action ?? ''),
        esc(r.crm?.next_action_due ?? ''),
        esc(r.match?.joined_at?.slice(0, 10) ?? ''),
        esc(r.match?.activated ? 'yes' : ''),
        esc(r.crm?.notes ?? ''),
      ].join(','),
    )

    return new NextResponse([header, ...lines].join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="scout-recruiting-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
