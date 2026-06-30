import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Per-user activity metrics for the admin Data dashboard. Aggregated from the
// authoritative domain tables (service role bypasses RLS), so it reflects real
// history — not just events emitted after this shipped:
//   suggested  = outreach_queue rows (every agent pick is a queue row)
//   saved      = user_networks rows
//   skipped    = dismissed picks + alumni_swipes 'pass'
//   generated  = queue rows with a real draft written
//   sent       = messages rows
//   events     = user_events rows (the broad trackEvent stream)

async function fetchAll<T = Record<string, unknown>>(
  db: SupabaseClient, table: string, columns: string,
): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

interface UserRow {
  userId: string
  email: string
  name: string
  role: string
  suggested: number
  saved: number
  skipped: number
  generated: number
  sent: number
  events: number
  lastActiveAt: string | null
}

export async function GET(_request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const [profiles, queue, networks, swipes, messages, events] = await Promise.all([
      fetchAll<{ id: string; email: string | null; full_name: string | null; account_role: string | null; created_at: string | null }>(
        db, 'profiles', 'id, email, full_name, account_role, created_at'),
      fetchAll<{ user_id: string; status: string | null; draft_body: string | null; created_at: string | null }>(
        db, 'outreach_queue', 'user_id, status, draft_body, created_at'),
      fetchAll<{ user_id: string; created_at: string | null }>(db, 'user_networks', 'user_id, created_at'),
      fetchAll<{ user_id: string; action: string | null }>(db, 'alumni_swipes', 'user_id, action'),
      fetchAll<{ user_id: string; created_at: string | null }>(db, 'messages', 'user_id, created_at'),
      fetchAll<{ user_id: string; created_at: string | null }>(db, 'user_events', 'user_id, created_at'),
    ])

    const byId = new Map<string, UserRow>()
    for (const p of profiles) {
      byId.set(p.id, {
        userId: p.id, email: p.email ?? '', name: p.full_name ?? '', role: p.account_role ?? 'student',
        suggested: 0, saved: 0, skipped: 0, generated: 0, sent: 0, events: 0, lastActiveAt: null,
      })
    }
    const touch = (r: UserRow, ts: string | null) => {
      if (ts && (!r.lastActiveAt || ts > r.lastActiveAt)) r.lastActiveAt = ts
    }

    for (const q of queue) {
      const r = byId.get(q.user_id); if (!r) continue
      r.suggested++
      if (q.status === 'dismissed') r.skipped++
      if (q.draft_body && q.draft_body.trim().length > 10) r.generated++
      touch(r, q.created_at)
    }
    for (const n of networks) { const r = byId.get(n.user_id); if (r) { r.saved++; touch(r, n.created_at) } }
    for (const s of swipes) { const r = byId.get(s.user_id); if (r && s.action === 'pass') r.skipped++ }
    for (const m of messages) { const r = byId.get(m.user_id); if (r) { r.sent++; touch(r, m.created_at) } }
    for (const e of events) { const r = byId.get(e.user_id); if (r) { r.events++; touch(r, e.created_at) } }

    const users = [...byId.values()].sort((a, b) => (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? ''))
    const sum = (k: keyof UserRow) => users.reduce((t, u) => t + (u[k] as number), 0)
    const totals = {
      users: users.length,
      activeUsers: users.filter(u => u.lastActiveAt).length,
      suggested: sum('suggested'),
      saved: sum('saved'),
      skipped: sum('skipped'),
      generated: sum('generated'),
      sent: sum('sent'),
      events: sum('events'),
    }

    return ok({ totals, users, generatedAt: new Date().toISOString() })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
