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

const MS_PER_DAY = 86_400_000;

// ─── Canonical relationship status (unified vocabulary — see migration) ─────
export type ConnectionStatus =
  | 'saved'
  | 'contacted'
  | 'replied'
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
  if (c.status === 'replied') {
    return base('RESPOND', 'They replied — keep the conversation going', 'follow_up');
  }

  // Reliable-signal branches — work regardless of status (which is often null).
  const isContacted = c.contacted || c.lastMessageAt != null;
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
  cap: number = OUTREACH_PER_DAY_CAP,
): RankedQueue {
  const byFit = new Map(connections.map((c) => [c.alumniId, c.fitScore]));
  const actions = connections.map((c) => nextBestAction(c, now));

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
