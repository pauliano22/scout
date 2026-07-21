import { serviceClient } from '@/lib/requestAuth'

// The report shown to an Athletic Director: roster penetration, student
// activation, the outreach funnel, and what connections actually led to.
// Everything here is computed from tables that already exist — the one
// exception is `outcomes`, which is null until migration 058 is applied.
export type AdReport = {
  generated_for_days: number // window for "recent" metrics
  students: {
    total: number
    new_in_window: number
    active_in_window: number // distinct users with a user_events row
    sent_at_least_one_message: number
  }
  funnel: {
    connections_saved: number
    contacted: number
    replied: number
    meetings: number // meeting_scheduled or met
    met: number
    reply_rate: number | null // replied / contacted
    meeting_rate: number | null // meetings / replied
    median_days_to_reply: number | null
  }
  outcomes: Record<'helpful_convo' | 'referral' | 'interview' | 'offer', number> | null
  messages: {
    total: number
    by_channel: Record<string, number> // sent_via — 'copied' may never have left Scout
  }
  alumni: {
    directory_total: number
    claimed: number
    claim_rate: number | null
    intent: { seeking_employment: number; here_to_help: number; both: number; unknown: number }
  }
  roster: {
    entries_total: number
    coverage_by_sport: Array<{ sport: string; roster: number; directory: number; ratio: number | null }>
  }
}

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null)

export async function buildAdReport(windowDays = 30): Promise<AdReport> {
  const db = serviceClient()
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString()

  // Exclude soft-deleted duplicate rows (migration 061) from directory counts —
  // but only when the column exists, so the report still works pre-migration.
  const dedupProbe = await db.from('alumni').select('id', { count: 'exact', head: true }).eq('is_duplicate', true)
  const hasDedup = !dedupProbe.error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notDup = <T,>(q: T): T => (hasDedup ? (q as any).eq('is_duplicate', false) : q)

  const [
    studentsRes,
    newStudentsRes,
    activeRes,
    sendersRes,
    connectionsRes,
    contactedRes,
    repliedRes,
    meetingsRes,
    metRes,
    replyTimesRes,
    messagesRes,
    alumniRes,
    claimedRes,
    intentRes,
    rosterSportsRes,
    alumniSportsRes,
  ] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('account_role', 'student'),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('account_role', 'student').gte('created_at', since),
    db.from('user_events').select('user_id').gte('created_at', since).limit(20000),
    db.from('messages').select('user_id').limit(20000),
    db.from('user_networks').select('id', { count: 'exact', head: true }),
    // Contacted/replied are DERIVED from status as well as timestamps: rows
    // moved via the modal dropdown or mobile stepper before 2026-07-20 carry a
    // reply-implying status but no timestamp, so timestamp-only counts blind
    // the report (it showed 0 replies against 14 status-implied ones).
    // (.or() is safe on SELECTs — the PostgREST 400 rule only hits mutations.)
    db.from('user_networks').select('id', { count: 'exact', head: true })
      .or('contacted_at.not.is.null,contacted.eq.true,status.in.(awaiting_reply,response_needed,meeting_scheduled,met)'),
    db.from('user_networks').select('id', { count: 'exact', head: true })
      .or('replied_at.not.is.null,status.in.(response_needed,meeting_scheduled,met)'),
    db.from('user_networks').select('id', { count: 'exact', head: true }).in('status', ['meeting_scheduled', 'met']),
    db.from('user_networks').select('id', { count: 'exact', head: true }).eq('status', 'met'),
    db.from('user_networks').select('contacted_at, replied_at').not('replied_at', 'is', null).not('contacted_at', 'is', null).limit(10000),
    db.from('messages').select('sent_via').limit(20000),
    notDup(db.from('alumni').select('id', { count: 'exact', head: true })),
    notDup(db.from('alumni').select('id', { count: 'exact', head: true }).eq('is_claimed', true)),
    notDup(db.from('alumni').select('engagement_intent').not('engagement_intent', 'is', null).limit(20000)),
    db.from('roster_entries').select('sport').limit(20000),
    notDup(db.from('alumni').select('sport').limit(20000)),
  ])

  const activeUsers = new Set((activeRes.data ?? []).map(r => (r as { user_id: string }).user_id))
  const senders = new Set((sendersRes.data ?? []).map(r => (r as { user_id: string }).user_id))

  const replyDays = (replyTimesRes.data ?? [])
    .map(r => {
      const row = r as { contacted_at: string; replied_at: string }
      return (new Date(row.replied_at).getTime() - new Date(row.contacted_at).getTime()) / 86_400_000
    })
    // Same-instant pairs are stamping artifacts, not real reply latency: when a
    // student jumps straight to a reply-implying status, contacted_at and
    // replied_at get the same first-touch timestamp. Excluding them (and the
    // negative deltas from legacy clobbered rows) keeps the median honest.
    .filter(d => d > 0.001)
    .sort((a, b) => a - b)
  const medianDaysToReply = replyDays.length
    ? Math.round(replyDays[Math.floor(replyDays.length / 2)] * 10) / 10
    : null

  const byChannel: Record<string, number> = {}
  for (const r of messagesRes.data ?? []) {
    const via = (r as { sent_via: string | null }).sent_via ?? 'unknown'
    byChannel[via] = (byChannel[via] ?? 0) + 1
  }

  const intent = { seeking_employment: 0, here_to_help: 0, both: 0, unknown: 0 }
  for (const r of intentRes.data ?? []) {
    const v = (r as { engagement_intent: string }).engagement_intent as keyof typeof intent
    if (v in intent) intent[v] += 1
  }
  intent.unknown = Math.max(0, (alumniRes.count ?? 0) - intent.seeking_employment - intent.here_to_help - intent.both)

  // Coverage: alumni directory size vs roster size per sport. This is a
  // volume comparison, not a row-level match — roster↔alumni linking is
  // name-based and lives in the claim flow, not here.
  const countBySport = (rows: Array<Record<string, unknown>> | null | undefined): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const r of rows ?? []) {
      const s = ((r as { sport: string | null }).sport ?? '').trim()
      if (!s) continue
      out[s] = (out[s] ?? 0) + 1
    }
    return out
  }
  const rosterBySport = countBySport(rosterSportsRes.data)
  const directoryBySport = countBySport(alumniSportsRes.data)
  const coverage = Object.keys(rosterBySport)
    .map(sport => ({
      sport,
      roster: rosterBySport[sport],
      directory: directoryBySport[sport] ?? 0,
      ratio: ratio(directoryBySport[sport] ?? 0, rosterBySport[sport]),
    }))
    .sort((a, b) => b.roster - a.roster)

  // Outcomes require migration 058; report null (not zeros) until it lands so
  // the UI can say "not yet tracked" instead of implying zero results.
  let outcomes: AdReport['outcomes'] = null
  const outcomeRes = await db.from('user_networks').select('outcome').not('outcome', 'is', null).limit(20000)
  if (!outcomeRes.error) {
    outcomes = { helpful_convo: 0, referral: 0, interview: 0, offer: 0 }
    for (const r of outcomeRes.data ?? []) {
      const v = (r as { outcome: string }).outcome as keyof NonNullable<AdReport['outcomes']>
      if (v in outcomes) outcomes[v] += 1
    }
  }

  const contacted = contactedRes.count ?? 0
  const replied = repliedRes.count ?? 0
  const meetings = meetingsRes.count ?? 0

  return {
    generated_for_days: windowDays,
    students: {
      total: studentsRes.count ?? 0,
      new_in_window: newStudentsRes.count ?? 0,
      active_in_window: activeUsers.size,
      sent_at_least_one_message: senders.size,
    },
    funnel: {
      connections_saved: connectionsRes.count ?? 0,
      contacted,
      replied,
      meetings,
      met: metRes.count ?? 0,
      reply_rate: ratio(replied, contacted),
      meeting_rate: ratio(meetings, replied),
      median_days_to_reply: medianDaysToReply,
    },
    outcomes,
    messages: { total: messagesRes.data?.length ?? 0, by_channel: byChannel },
    alumni: {
      directory_total: alumniRes.count ?? 0,
      claimed: claimedRes.count ?? 0,
      claim_rate: ratio(claimedRes.count ?? 0, alumniRes.count ?? 0),
      intent,
    },
    roster: {
      entries_total: rosterSportsRes.data?.length ?? 0,
      coverage_by_sport: coverage,
    },
  }
}

export function adReportToCsv(r: AdReport): string {
  const pct = (v: number | null) => (v === null ? '' : (v * 100).toFixed(1) + '%')
  const rows: string[] = ['metric,value']
  rows.push(`window_days,${r.generated_for_days}`)
  rows.push(`students_total,${r.students.total}`)
  rows.push(`students_new_in_window,${r.students.new_in_window}`)
  rows.push(`students_active_in_window,${r.students.active_in_window}`)
  rows.push(`students_sent_a_message,${r.students.sent_at_least_one_message}`)
  rows.push(`connections_saved,${r.funnel.connections_saved}`)
  rows.push(`contacted,${r.funnel.contacted}`)
  rows.push(`replied,${r.funnel.replied}`)
  rows.push(`meetings,${r.funnel.meetings}`)
  rows.push(`met,${r.funnel.met}`)
  rows.push(`reply_rate,${pct(r.funnel.reply_rate)}`)
  rows.push(`meeting_rate,${pct(r.funnel.meeting_rate)}`)
  rows.push(`median_days_to_reply,${r.funnel.median_days_to_reply ?? ''}`)
  if (r.outcomes) {
    for (const [k, v] of Object.entries(r.outcomes)) rows.push(`outcome_${k},${v}`)
  }
  rows.push(`messages_total,${r.messages.total}`)
  for (const [k, v] of Object.entries(r.messages.by_channel)) rows.push(`messages_${k},${v}`)
  rows.push(`alumni_directory_total,${r.alumni.directory_total}`)
  rows.push(`alumni_claimed,${r.alumni.claimed}`)
  rows.push(`alumni_claim_rate,${pct(r.alumni.claim_rate)}`)
  for (const [k, v] of Object.entries(r.alumni.intent)) rows.push(`alumni_intent_${k},${v}`)
  rows.push(`roster_entries_total,${r.roster.entries_total}`)
  for (const c of r.roster.coverage_by_sport) {
    rows.push(`roster_${c.sport.replace(/[^a-zA-Z0-9]+/g, '_')}_coverage,${c.directory}/${c.roster}`)
  }
  return rows.join('\n')
}
