import { createClient } from '@/lib/supabase/server'

export type MonthlyReport = {
  month: string // YYYY-MM
  range: { start: string; end: string }
  signups: { total: number; by_role: Record<string, number> }
  active_alumni: number
  events: { held: number; rsvps: number; attendance_ratio: number | null }
  opportunities: { posted: number; saves: number }
  outreach: { messages_sent: number }
  teams: Record<string, { signups: number; events: number; opportunities: number }>
}

export async function buildMonthlyReport(month: string): Promise<MonthlyReport> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('month must be YYYY-MM')
  }
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString()
  const end = new Date(Date.UTC(y, m, 1)).toISOString()

  const supabase = createClient()

  const [
    signupsRes,
    activeAlumniRes,
    eventsRes,
    rsvpsRes,
    opportunitiesRes,
    savesRes,
    messagesRes,
    teamSignupsRes,
    teamEventsRes,
    teamOppsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('account_role', { count: 'exact' }).gte('created_at', start).lt('created_at', end),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('account_role', 'alumni'),
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('starts_at', start).lt('starts_at', end).eq('is_cancelled', false),
    supabase.from('event_rsvps').select('status', { count: 'exact' }).gte('created_at', start).lt('created_at', end),
    supabase.from('opportunities').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
    supabase.from('opportunity_saves').select('opportunity_id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
    supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
    supabase.from('profiles').select('team').gte('created_at', start).lt('created_at', end),
    supabase.from('events').select('team').gte('starts_at', start).lt('starts_at', end),
    supabase.from('opportunities').select('team').gte('created_at', start).lt('created_at', end),
  ])

  const byRole: Record<string, number> = { student: 0, alumni: 0, admin: 0 }
  for (const row of signupsRes.data ?? []) {
    const r = (row as { account_role: string }).account_role
    byRole[r] = (byRole[r] ?? 0) + 1
  }

  const rsvpTotal = rsvpsRes.count ?? 0
  const rsvpGoing = (rsvpsRes.data ?? []).filter(r => (r as { status: string }).status === 'going').length
  const eventsHeld = eventsRes.count ?? 0

  const teams: MonthlyReport['teams'] = {}
  const bump = (code: string | null | undefined, key: 'signups' | 'events' | 'opportunities') => {
    const k = code ?? 'none'
    if (!teams[k]) teams[k] = { signups: 0, events: 0, opportunities: 0 }
    teams[k][key] += 1
  }
  for (const r of teamSignupsRes.data ?? []) bump((r as { team: string | null }).team, 'signups')
  for (const r of teamEventsRes.data ?? []) bump((r as { team: string | null }).team, 'events')
  for (const r of teamOppsRes.data ?? []) bump((r as { team: string | null }).team, 'opportunities')

  return {
    month,
    range: { start, end },
    signups: { total: signupsRes.count ?? 0, by_role: byRole },
    active_alumni: activeAlumniRes.count ?? 0,
    events: {
      held: eventsHeld,
      rsvps: rsvpTotal,
      attendance_ratio: eventsHeld > 0 ? rsvpGoing / eventsHeld : null,
    },
    opportunities: {
      posted: opportunitiesRes.count ?? 0,
      saves: savesRes.count ?? 0,
    },
    outreach: { messages_sent: messagesRes.count ?? 0 },
    teams,
  }
}

export function reportToCsv(r: MonthlyReport): string {
  const rows: string[] = []
  rows.push('metric,value')
  rows.push(`month,${r.month}`)
  rows.push(`signups_total,${r.signups.total}`)
  for (const [role, n] of Object.entries(r.signups.by_role)) rows.push(`signups_${role},${n}`)
  rows.push(`active_alumni,${r.active_alumni}`)
  rows.push(`events_held,${r.events.held}`)
  rows.push(`events_rsvps,${r.events.rsvps}`)
  rows.push(`attendance_ratio,${r.events.attendance_ratio ?? ''}`)
  rows.push(`opportunities_posted,${r.opportunities.posted}`)
  rows.push(`opportunities_saves,${r.opportunities.saves}`)
  rows.push(`messages_sent,${r.outreach.messages_sent}`)
  for (const [team, v] of Object.entries(r.teams)) {
    rows.push(`team_${team}_signups,${v.signups}`)
    rows.push(`team_${team}_events,${v.events}`)
    rows.push(`team_${team}_opportunities,${v.opportunities}`)
  }
  return rows.join('\n')
}

export function defaultPreviousMonth(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
