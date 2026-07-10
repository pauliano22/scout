// The daily-picks engine. Picks accrue BETWEEN logins — never on a cron — so a
// student who logs in weekly costs a week's worth of nothing and gets up to the
// card cap waiting. Rules:
//   · first ever visit seeds SEED_PICKS immediately (home is never empty)
//   · afterwards, 1 new pick per elapsed day since the last materialization
//   · unactioned picks roll forward; beyond CARD_CAP the oldest expire
//   · drafts are NOT pre-written — they generate on first open (see /api/picks/draft)
// Picks live in outreach_queue (status queued_for_approval) so the existing
// send path — approval gate, cross-user outreach ledger — applies unchanged,
// and any drafts the pilot cron already wrote surface as ready picks.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Alumni } from '@scout/shared/types/database'
import { scoreAlumnus, deriveTargetDbIndustries, type UserPreferences, type WarmPathSummary } from '@scout/shared/scoring/recommendationScoring'
import { sourcingConfidence, hasPersonalizationHook, locationMatch } from '@/lib/agent/sourceAlumniGate'
import { channelForAlumni } from '@/lib/agent/draftMessage'
import { warmPathsFor } from '@/lib/alumni-circle'
import { ensureAgentState, defaultDeadline, DEFAULT_GOAL_COUNT } from '@/lib/campaign/goal'

// Every alumni column EXCEPT the pgvector embedding (1536 floats/row — selecting
// it via '*' made each candidate pool ~50MB and took the Supabase instance down
// during backfill). Never select('*') on alumni in hot paths.
export const ALUMNI_COLS = 'id, full_name, email, linkedin_url, sport, graduation_year, company, role, industry, location, avatar_url, photo_url, is_verified, is_public, source, school_id, created_at, updated_at, work_history, skills, education, display_headline, path_summary_stub, current_status_type, bio, advice, share_email_with_students, is_claimed, claimed_at, claim_source, claimed_by_user_id, profile_reviewed_by_alumni, engagement_intent, prestige_score'

export const SEED_PICKS = 3
// 3 cards max: enough to act on without feeling like a queue to clear.
// (Was 5; lowered 2026-07 — founders felt 5 read as homework.)
export const CARD_CAP = 3
// Unactioned picks rotate out after this many days. Without a TTL, a full
// shelf blocks new mints forever and the home shows the same stale cards on
// every visit — found live 2026-07-09 (5 cards from Jun 30, nothing new since).
export const PICK_TTL_DAYS = 7
const MS_PER_DAY = 86_400_000

export interface PickCard {
  queueId: string
  alumnus: Alumni
  why: string
  draftReady: boolean
  warm: WarmPathSummary | null
  createdAt: string
}

export interface PicksPayload {
  picks: PickCard[]
  paused: boolean
  field: string | null
  coverage: number | null
  needsField: boolean
}

/** "Football '12 · IB at Goldman" — the one-line why. */
export function reasonLine(a: Alumni): string {
  const sportBit = [a.sport, a.graduation_year ? `'${String(a.graduation_year).slice(2)}` : null]
    .filter(Boolean).join(' ')
  const workBit = [a.role, a.company].filter(Boolean).join(' at ')
  return [sportBit, workBit || a.industry].filter(Boolean).join(' · ')
}

function profilePrefs(profile: any): UserPreferences {
  return {
    industries: [profile.primary_industry, ...(profile.secondary_industries ?? [])].filter(Boolean),
    sports: profile.sport ? [profile.sport] : [],
    // Students type comma'd lists ("Midwest, Northeast") — each part is a target
    locations: (Array.isArray(profile.preferred_locations) ? profile.preferred_locations : [])
      .flatMap((l: string) => String(l).split(',')).map((l: string) => l.trim()).filter(Boolean),
    roles: Array.isArray(profile.target_roles) ? profile.target_roles : [],
    companies: [],
    priorities: { sameSport: true, similarIndustry: true, seniorAlumni: false },
  }
}

/**
 * Materialize today's picks for a student. Lazy + idempotent: call it on every
 * home load; it only mints new rows when days have elapsed (or nothing exists).
 */
export async function materializePicks(db: SupabaseClient, userId: string): Promise<PicksPayload> {
  await ensureAgentState(db, userId)

  const { data: profile } = await db
    .from('profiles')
    .select('primary_industry, secondary_industries, target_roles, preferred_locations, sport, graduation_year, full_name')
    .eq('id', userId)
    .single()
  if (!profile) return { picks: [], paused: false, field: null, coverage: null, needsField: true }

  let { data: plan } = await db
    .from('networking_plans')
    .select('id, sourcing_enabled, last_sourced_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  // Self-heal: without an active plan nothing below can mint, and the home is
  // silently empty forever (found on a real account 2026-07). If onboarding's
  // autostart never created one, create the default here.
  if (!plan) {
    const { data: created, error: planErr } = await db
      .from('networking_plans')
      .insert({
        user_id: userId,
        title: 'Networking campaign',
        is_active: true,
        goal_metric: 'informational_interview',
        goal_count: DEFAULT_GOAL_COUNT,
        deadline: defaultDeadline(),
        campaign_status: 'active',
        sourcing_enabled: true,
      })
      .select('id, sourcing_enabled, last_sourced_at')
      .single()
    if (planErr) console.error('[picks] self-heal plan insert failed:', planErr.message)
    else plan = created
  }

  const paused = plan ? plan.sourcing_enabled === false : false

  // Current pending picks (intro drafts in the queue), oldest first
  const { data: queueRows, error: qErr } = await db
    .from('outreach_queue')
    .select(`id, alumni_id, draft_body, why, created_at, alumni:alumni(${ALUMNI_COLS})`)
    .eq('user_id', userId)
    .eq('message_type', 'introduction')
    .eq('status', 'queued_for_approval')
    .order('created_at', { ascending: true })
  if (qErr) console.error('[picks] queue select error:', qErr.message)
  let pending = (queueRows ?? []).filter(r => r.alumni)

  // Rotation: picks the student never acted on go stale — expire them quietly
  // so fresh suggestions can mint. Same silent-dismiss path as the cap.
  const ttlCutoff = Date.now() - PICK_TTL_DAYS * MS_PER_DAY
  const stale = pending.filter(r => new Date(r.created_at as string).getTime() < ttlCutoff)
  if (stale.length) {
    await db.from('outreach_queue').update({ status: 'dismissed' }).in('id', stale.map(r => r.id))
    pending = pending.filter(r => new Date(r.created_at as string).getTime() >= ttlCutoff)
  }

  // Cap: oldest beyond CARD_CAP expire (dismissed quietly, not counted as a skip)
  while (pending.length > CARD_CAP) {
    const oldest = pending.shift()!
    await db.from('outreach_queue').update({ status: 'dismissed' }).eq('id', oldest.id)
  }

  // Accrual: ever-materialized? (any intro row, any status, or last_sourced_at set)
  const { count: everCount } = await db
    .from('outreach_queue')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('message_type', 'introduction')
  const lastSourced = plan?.last_sourced_at ? new Date(plan.last_sourced_at).getTime() : null
  // Seed = "this student has never had a pick", full stop. (A stamp without
  // rows can happen when a seeding run dies mid-write — they must still seed.)
  const isFirstVisit = (everCount ?? 0) === 0

  let grant = 0
  if (!paused) {
    if (isFirstVisit) {
      grant = SEED_PICKS
    } else if (lastSourced !== null) {
      const elapsedDays = Math.floor((Date.now() - lastSourced) / MS_PER_DAY)
      grant = Math.max(0, Math.min(elapsedDays, CARD_CAP - pending.length))
    }
    // (rows exist but no stamp: pilot-cron era — clock starts today, grant 0)
  }

  if (grant > 0 && plan) {
    const minted = await mintPicks(db, userId, plan.id, profile, pending.map(r => r.alumni_id as string), grant)
    pending = pending.concat(minted)
    await db.from('networking_plans').update({ last_sourced_at: new Date().toISOString() }).eq('id', plan.id)
  } else if (isFirstVisit && plan) {
    // Seed attempt happened (even if zero matched) — stamp so accrual starts
    await db.from('networking_plans').update({ last_sourced_at: new Date().toISOString() }).eq('id', plan.id)
  }

  // Warm paths for display
  const { data: network } = await db
    .from('user_networks').select('alumni_id, status').eq('user_id', userId)
  const saved = (network ?? [])
    .filter(n => !['proposed', 'not_interested'].includes((n.status as string) ?? ''))
    .map(n => ({ alumniId: n.alumni_id as string, status: (n.status as string) ?? null }))
  const warm = await warmPathsFor(pending.map(r => r.alumni_id as string), saved).catch(() => ({} as Record<string, WarmPathSummary>))

  // Coverage line ("from 381 Finance alumni")
  const field = (profile.primary_industry as string) ?? null
  let coverage: number | null = null
  if (field) {
    const { count } = await db
      .from('alumni').select('id', { count: 'exact', head: true }).eq('industry', field)
    coverage = count ?? null
  }

  return {
    // Newest suggestions first so freshly-sourced alumni surface at the top.
    // (pending stays oldest-first above for the CARD_CAP expiry; only this
    // returned view is reordered.)
    picks: pending
      .map(r => ({
        queueId: r.id as string,
        alumnus: r.alumni as unknown as Alumni,
        why: (r.why as string) || reasonLine(r.alumni as unknown as Alumni),
        draftReady: !!(r.draft_body as string)?.trim(),
        warm: warm[r.alumni_id as string] ?? null,
        createdAt: r.created_at as string,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    paused,
    field,
    coverage,
    needsField: !field,
  }
}

/** Select + insert `grant` new picks. Tiered so home is never empty:
 *  agent-vetted proposed rows → gate-HIGH → industry/role match → sport+era. */
async function mintPicks(
  db: SupabaseClient,
  userId: string,
  planId: string,
  profile: any,
  excludeAlumniIds: string[],
  grant: number,
) {
  const prefs = profilePrefs(profile)
  const exclude = new Set(excludeAlumniIds)

  // Everything the student has already acted on (any queue row, swipes, network)
  const [{ data: priorQueue }, { data: swipes }, { data: net }] = await Promise.all([
    db.from('outreach_queue').select('alumni_id').eq('user_id', userId),
    db.from('alumni_swipes').select('alumni_id').eq('user_id', userId),
    db.from('user_networks').select('alumni_id, status').eq('user_id', userId),
  ])
  for (const r of priorQueue ?? []) exclude.add(r.alumni_id as string)
  for (const r of swipes ?? []) exclude.add(r.alumni_id as string)
  const proposedIds: string[] = []
  for (const r of net ?? []) {
    if ((r.status as string) === 'proposed') proposedIds.push(r.alumni_id as string)
    else exclude.add(r.alumni_id as string)
  }

  const chosen: Alumni[] = []

  // Tier 0 — alumni the agent already vetted onto the proposed shelf
  if (proposedIds.length) {
    const { data: rows } = await db.from('alumni').select(ALUMNI_COLS).in('id', proposedIds.slice(0, 20))
    for (const a of (rows ?? []) as Alumni[]) {
      if (chosen.length >= grant || exclude.has(a.id)) continue
      chosen.push(a); exclude.add(a.id)
    }
  }

  // Tier 1+2 — candidate pool by target industries (else prestige pool), scored
  if (chosen.length < grant) {
    const targetIndustries = deriveTargetDbIndustries(prefs.industries)
    let pool: Alumni[] = []
    if (targetIndustries.length) {
      const { data } = await db.from('alumni').select(ALUMNI_COLS).eq('is_public', true).in('industry', targetIndustries).limit(1000)
      pool = (data ?? []) as Alumni[]
    }
    if (pool.length < 50) {
      const { data } = await db.from('alumni').select(ALUMNI_COLS).eq('is_public', true)
        .order('prestige_score', { ascending: false, nullsFirst: false }).limit(400)
      pool = pool.concat(((data ?? []) as Alumni[]).filter(a => !pool.some(p => p.id === a.id)))
    }
    const candidates = pool.filter(a => !exclude.has(a.id))

    // Warm-path boost for ranking
    const { data: network } = await db.from('user_networks').select('alumni_id, status').eq('user_id', userId)
    const savedForBoost = (network ?? [])
      .filter(n => !['proposed', 'not_interested'].includes((n.status as string) ?? ''))
      .map(n => ({ alumniId: n.alumni_id as string, status: (n.status as string) ?? null }))
    const shortIds = candidates.slice(0, 600).map(a => a.id)
    const warmBoost = await warmPathsFor(shortIds, savedForBoost).catch(() => ({} as Record<string, WarmPathSummary>))

    const targetLocations = prefs.locations
    const scored = candidates
      .map(a => ({
        a,
        conf: sourcingConfidence(a, prefs, profile.sport ?? null, targetLocations),
        hook: hasPersonalizationHook(a, profile.sport ?? null, targetLocations),
        score: scoreAlumnus(a, prefs, {}, warmBoost[a.id]).score,
      }))
      .sort((x, y) =>
        Number(y.conf === 'high') - Number(x.conf === 'high') ||
        Number(y.hook) - Number(x.hook) ||
        y.score - x.score
      )
    for (const s of scored) {
      if (chosen.length >= grant) break
      if (s.conf !== 'high' && !s.hook) continue // tier 3 below handles the rest
      chosen.push(s.a); exclude.add(s.a.id)
    }
    // Tier 3 — never-empty: same sport, overlapping era, regardless of field
    if (chosen.length < grant && profile.sport) {
      for (const s of scored) {
        if (chosen.length >= grant) break
        if (s.a.sport && s.a.sport.toLowerCase() === String(profile.sport).toLowerCase()) {
          chosen.push(s.a); exclude.add(s.a.id)
        }
      }
    }
    // Tier 4 — absolute floor: top-scored remainder
    for (const s of scored) {
      if (chosen.length >= grant) break
      chosen.push(s.a); exclude.add(s.a.id)
    }
  }

  // Insert as queue rows (draft written on first open, not now)
  const inserted: any[] = []
  for (const a of chosen) {
    const { data: row, error } = await db
      .from('outreach_queue')
      .insert({
        user_id: userId,
        alumni_id: a.id,
        plan_id: planId,
        message_type: 'introduction',
        channel: channelForAlumni(a),
        draft_body: '',
        why: reasonLine(a),
        status: 'queued_for_approval',
      })
      .select('id, alumni_id, draft_body, why, created_at')
      .single()
    if (error && !/duplicate key/.test(error.message)) console.error('[picks] insert error:', error.message)
    if (!error && row) inserted.push({ ...row, alumni: a })
  }
  return inserted
}
