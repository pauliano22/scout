// Phase 0 — "Next Best Action" engine.
//
// Pure and I/O-free, exactly like recommendationScoring.ts: NO Supabase /
// network / LLM / react-native / next imports, so it runs in any runtime
// (web route, mobile, offline eval). The I/O — fetching connections, building
// the message draft — happens at the call sites.
//
// Given one saved connection's reliable signals, it returns the single best
// next action. The companion `rankActions` turns a list of connections into a
// ranked queue (today / later / waiting), enforcing the per-day outreach cap.
//
// DESIGN: the action is DERIVED from state, never an LLM judgement. The engine
// leans on the RELIABLE signals (`contacted`, `lastMessageAt`) for the
// new-vs-awaiting-vs-stale distinction, and uses `status` only as a soft hint
// for the states we can't infer otherwise (replied / meeting / met /
// not_interested). `status` is frequently null or 'saved', so every branch
// degrades gracefully without it. Reply/meeting detection is MANUAL in Phase 0
// (set via the network PATCH endpoint); auto-detection is deferred to Phase 2.

// ─── Tunable config (one place; one-line changes) ──────────────────────────
/** Ceiling — NOT a target — on outreach-initiating actions surfaced as "today". */
export const OUTREACH_PER_DAY_CAP = 5;
/** Days since the last outbound message before a contacted connection earns a nudge. */
export const FOLLOWUP_STALE_DAYS = 7;
/** Cold-outreach follow-up cap: ONE gentle nudge to a favor-doer, then quiet-close. */
export const MAX_COLD_FOLLOWUPS = 1;

// ── Cross-user corpus protection (enforced by the sourcing gate, not the engine) ──
/** Max DISTINCT students who may be auto-sourced onto one alum within the window.
 *  Protective default (≈ an alum hears from ≤1 Scout student every ~45 days);
 *  loosen with data. The corpus's life insurance — err protective. */
export const ALUMNI_OUTREACH_MAX_STUDENTS = 2;
export const ALUMNI_OUTREACH_WINDOW_DAYS = 90;
/** Re-source only when the approved-but-uncontacted list has < this much pacing left
 *  (also caps the OpenAI embed+rerank sourcing spend to ~weekly per user). */
export const SOURCING_REFILL_DAYS = 7;
/** Campaign target-count default by the student's networking_intensity. */
export const CAMPAIGN_COUNT_BY_INTENSITY: Record<string, number> = { '20': 5, '10': 3, '5': 2, own_pace: 3 };

const MS_PER_DAY = 86_400_000;

// ─── Canonical relationship status (unified vocabulary — see migration 025) ──
// This is the existing web/TS-type vocabulary that the live control-arm UI
// already uses; migration 025 normalizes every historical value (incl. the
// old mobile/PATCH set) into it. Lifecycle: interested → awaiting_reply →
// response_needed → meeting_scheduled → met (+ not_interested = closed).
export type ConnectionStatus =
  | 'proposed'        // cron-sourced, NOT yet approved by the student — never live outreach
  | 'interested'
  | 'awaiting_reply'
  | 'response_needed'
  | 'meeting_scheduled'
  | 'met'
  | 'not_interested';

export type ActionType =
  | 'DRAFT_INTRO'
  | 'SEND_FOLLOWUP'
  | 'RESPOND'
  | 'PREP_MEETING'
  | 'SEND_THANKYOU'
  | 'AWAIT'; // muted — nothing to do yet (or not interested)

/** What tapping the action opens in the existing compose flow (null = not a message). */
export type ComposeType = 'introduction' | 'follow_up' | 'thank_you' | null;

/** Per-connection signals, assembled at the I/O layer from user_networks + messages. */
export interface ConnectionSignals {
  alumniId: string;
  status: ConnectionStatus | null; // soft hint; often null/'saved'
  contacted: boolean;
  contactedAt: string | null; // ISO
  lastMessageAt: string | null; // ISO — max(messages.created_at) for this connection
  meetingAt: string | null; // ISO — nullable; gates timed PREP_MEETING
  fitScore: number; // from scoreAlumnus — tie-break only
}

export interface SuggestedAction {
  alumniId: string;
  type: ActionType;
  /** Higher = more urgent. Ranking key. */
  priority: number;
  /** Templated, no LLM. */
  reason: string;
  compose: ComposeType;
  /** Days since last outbound (for SEND_FOLLOWUP / AWAIT display). */
  daysWaiting?: number;
}

// Outreach-INITIATING actions — the only ones the per-day cap applies to.
// Responding/prepping/thanking are reactions to the alum, never capped.
const OUTREACH_ACTIONS: ReadonlySet<ActionType> = new Set<ActionType>([
  'DRAFT_INTRO',
  'SEND_FOLLOWUP',
]);

// Per-type base priority. Reacting to someone waiting on you outranks
// initiating new outreach; imminent meetings outrank everything but a reply.
const BASE_PRIORITY: Record<ActionType, number> = {
  RESPOND: 100,
  PREP_MEETING: 90,
  SEND_THANKYOU: 80,
  DRAFT_INTRO: 60,
  SEND_FOLLOWUP: 50,
  AWAIT: 0,
};

function daysBetween(isoEarlier: string, now: Date): number {
  const t = new Date(isoEarlier).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor((now.getTime() - t) / MS_PER_DAY);
}

function relativeMeeting(meetingIso: string, now: Date): string {
  const d = Math.round((new Date(meetingIso).getTime() - now.getTime()) / MS_PER_DAY);
  if (!Number.isFinite(d)) return 'soon';
  if (d < 0) return 'recently';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  return `in ${d} days`;
}

/**
 * The single best next action for one connection. Pure; pass `now` for
 * deterministic results (call sites pass `new Date()`).
 */
export function nextBestAction(c: ConnectionSignals, now: Date): SuggestedAction {
  const base = (type: ActionType, reason: string, compose: ComposeType, extra?: Partial<SuggestedAction>): SuggestedAction => ({
    alumniId: c.alumniId,
    type,
    priority: BASE_PRIORITY[type],
    reason,
    compose,
    ...extra,
  });

  // GATE (defense-in-depth): a cron-sourced alum awaiting the student's
  // who-to-contact approval is NEVER actionable outreach. The assembly also
  // routes 'proposed' rows to a separate approval shelf and doesn't feed them
  // here — but if one leaks in, it can never become DRAFT_INTRO.
  if (c.status === 'proposed') {
    return base('AWAIT', 'Awaiting your approval', null);
  }

  // Explicitly closed — never surface.
  if (c.status === 'not_interested') {
    return base('AWAIT', 'Marked not interested', null);
  }

  // State-driven branches — these states can only be known from the manual
  // status hint, so they require it explicitly.
  if (c.status === 'met') {
    return base('SEND_THANKYOU', 'You met — send a thank-you and a next step', 'thank_you');
  }
  if (c.status === 'meeting_scheduled') {
    const reason = c.meetingAt
      ? `Meeting ${relativeMeeting(c.meetingAt, now)} — prep now`
      : 'Meeting set — prep when you can';
    return base('PREP_MEETING', reason, null);
  }
  if (c.status === 'response_needed') {
    return base('RESPOND', 'They replied — keep the conversation going', 'follow_up');
  }

  // Reliable-signal branches — work regardless of status (often null/'interested').
  // 'met'/'meeting_scheduled'/'response_needed'/'not_interested' already
  // returned above, so among the remaining statuses only 'awaiting_reply'
  // implies prior contact (covers a row with status set but no logged message).
  const isContacted = c.contacted || c.lastMessageAt != null || c.status === 'awaiting_reply';
  if (!isContacted) {
    return base('DRAFT_INTRO', 'Not contacted yet — send an intro', 'introduction');
  }

  const ref = c.lastMessageAt ?? c.contactedAt;
  const waited = ref ? daysBetween(ref, now) : null;
  if (waited != null && waited >= FOLLOWUP_STALE_DAYS) {
    return base('SEND_FOLLOWUP', `No reply in ${waited} days — send a follow-up`, 'follow_up', { daysWaiting: waited });
  }

  return base(
    'AWAIT',
    waited != null ? `Waiting on a reply (${waited}d)` : 'Waiting on a reply',
    null,
    waited != null ? { daysWaiting: waited } : undefined,
  );
}

/** A user's dismiss/snooze override on a derived action (connection_action_state row). */
export interface ActionOverride {
  alumniId: string;
  actionType: ActionType;
  state: 'dismissed' | 'snoozed';
  snoozeUntil: string | null; // ISO; only meaningful when state = 'snoozed'
}

/** True if this action is currently suppressed by a dismiss or an unexpired snooze. */
function isSuppressed(a: SuggestedAction, overrides: ActionOverride[], now: Date): boolean {
  const o = overrides.find((x) => x.alumniId === a.alumniId && x.actionType === a.type);
  if (!o) return false;
  if (o.state === 'dismissed') return true;
  // snoozed: suppressed only while snoozeUntil is still in the future.
  return o.snoozeUntil != null && new Date(o.snoozeUntil).getTime() > now.getTime();
}

export interface RankedQueue {
  /** Actionable now, capped: outreach-initiating actions limited to the per-day ceiling. */
  today: SuggestedAction[];
  /** Outreach beyond today's cap — available, not urged. */
  later: SuggestedAction[];
  /** Muted: nothing to do yet (or not interested). */
  waiting: SuggestedAction[];
}

/**
 * Map a list of connections to their next actions and split into today / later
 * / waiting. Sort: priority desc, then alumni fit desc, then longest-waiting
 * first. The per-day cap applies ONLY to outreach-initiating actions.
 */
export function rankActions(
  connections: ConnectionSignals[],
  now: Date,
  overrides: ActionOverride[] = [],
  cap: number = OUTREACH_PER_DAY_CAP,
): RankedQueue {
  const byFit = new Map(connections.map((c) => [c.alumniId, c.fitScore]));
  // Dismiss/snooze remove an action entirely (not into any bucket).
  const actions = connections
    .map((c) => nextBestAction(c, now))
    .filter((a) => !isSuppressed(a, overrides, now));

  const waiting = actions.filter((a) => a.type === 'AWAIT');
  const actionable = actions
    .filter((a) => a.type !== 'AWAIT')
    .sort((a, b) =>
      b.priority - a.priority ||
      (byFit.get(b.alumniId) ?? 0) - (byFit.get(a.alumniId) ?? 0) ||
      (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0),
    );

  const today: SuggestedAction[] = [];
  const later: SuggestedAction[] = [];
  let outreachShown = 0;
  for (const a of actionable) {
    if (OUTREACH_ACTIONS.has(a.type)) {
      if (outreachShown < cap) {
        today.push(a);
        outreachShown++;
      } else {
        later.push(a);
      }
    } else {
      // Reactions (respond / prep / thank-you) are never capped.
      today.push(a);
    }
  }

  return { today, later, waiting };
}
