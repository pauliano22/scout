// Shared assembly for the agent loop — the single source of truth for turning a
// user's DB state into engine inputs. Called by BOTH the user-facing GET
// /api/today (cookie/RLS client) and the server-side cron /api/agent/tick
// (service-role client). Keeping one assembly means the live view and the
// between-login loop can never drift.
//
// Crucially this is where the WHO-TO-CONTACT GATE lives: 'proposed' rows
// (cron-sourced, not yet approved) are routed to `proposed` (the approval
// shelf) and are NEVER fed to the engine as actionable connections.

import { scoreAlumnus, type UserPreferences } from '@scout/shared/scoring/recommendationScoring'
import type { ConnectionSignals, ActionOverride } from '@scout/shared/agent/nextBestAction'
import type { Alumni, Profile } from '@scout/shared/types/database'

// Minimal structural client (works for both the SSR cookie client and the
// service-role client) — mirrors the loose typing used elsewhere in lib.
type DbClient = { from: (table: string) => any }

export function profileToPrefs(p: Profile | null): UserPreferences {
  const industries = [p?.primary_industry, ...(p?.secondary_industries ?? [])].filter(
    (v): v is string => Boolean(v),
  )
  return {
    industries,
    sports: p?.sport ? [p.sport] : [],
    locations: p?.preferred_locations ?? [],
    roles: p?.target_roles ?? [],
    companies: [],
    priorities: { sameSport: false, similarIndustry: true, seniorAlumni: false },
  }
}

export interface ProposedConnection {
  networkId: string
  alumnus: Alumni
  why: string | null // rerank reasoning, stashed in user_networks.notes by the cron
}

export interface AssembledConnections {
  /** Active connections fed to the engine (NEVER includes 'proposed'). */
  signals: ConnectionSignals[]
  overrides: ActionOverride[]
  /** alumniId → display payload for hydrating engine output. */
  display: Map<string, { networkId: string; alumnus: Alumni }>
  /** The who-to-contact approval shelf: cron-sourced, awaiting the student's OK. */
  proposed: ProposedConnection[]
}

/**
 * Assemble a user's connections into engine inputs. Pure data-shaping over the
 * DB; no engine decisions here. Fails soft on the non-critical reads (messages,
 * overrides) so a single error never blanks the queue.
 */
export async function assembleConnections(supabase: DbClient, userId: string): Promise<AssembledConnections> {
  const { data: nets, error: netErr } = await supabase
    .from('user_networks')
    .select('id, alumni_id, status, contacted, contacted_at, meeting_at, notes, alumni:alumni(*)')
    .eq('user_id', userId)
  if (netErr) throw new Error(`user_networks: ${netErr.message}`)

  // Last outbound message per alumni → lastMessageAt.
  const { data: msgs } = await supabase
    .from('messages')
    .select('alumni_id, created_at')
    .eq('user_id', userId)
  const lastMsg = new Map<string, string>()
  for (const m of msgs ?? []) {
    const prev = lastMsg.get(m.alumni_id as string)
    const at = m.created_at as string
    if (!prev || at > prev) lastMsg.set(m.alumni_id as string, at)
  }

  const { data: ovr } = await supabase
    .from('connection_action_state')
    .select('alumni_id, action_type, state, snooze_until')
    .eq('user_id', userId)
  const overrides: ActionOverride[] = (ovr ?? []).map((o: any) => ({
    alumniId: o.alumni_id,
    actionType: o.action_type,
    state: o.state,
    snoozeUntil: o.snooze_until,
  }))

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
  const prefs = profileToPrefs(profile as Profile | null)

  const display = new Map<string, { networkId: string; alumnus: Alumni }>()
  const proposed: ProposedConnection[] = []
  const signals: ConnectionSignals[] = []

  for (const n of (nets ?? []) as any[]) {
    const alumnus = n.alumni as Alumni | null
    if (alumnus) display.set(n.alumni_id, { networkId: n.id, alumnus })

    // GATE: proposed rows go to the approval shelf, never to the engine.
    if (n.status === 'proposed') {
      if (alumnus) proposed.push({ networkId: n.id, alumnus, why: n.notes ?? null })
      continue
    }

    signals.push({
      alumniId: n.alumni_id,
      status: n.status ?? null,
      contacted: !!n.contacted,
      contactedAt: n.contacted_at,
      lastMessageAt: lastMsg.get(n.alumni_id) ?? null,
      meetingAt: n.meeting_at ?? null,
      fitScore: alumnus ? scoreAlumnus(alumnus, prefs, {}).score : 0,
    })
  }

  return { signals, overrides, display, proposed }
}
