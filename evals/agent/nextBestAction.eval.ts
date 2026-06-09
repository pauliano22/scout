/**
 * Checkpoint B — fixture eval for the Next Best Action engine.
 *
 * No test framework in this repo, so this mirrors the existing tsx eval style
 * (see evals/alumniSearch/runEvals.ts): assert fixtures, print PASS/FAIL, exit
 * non-zero on any failure.
 *
 * Run: npx tsx evals/agent/nextBestAction.eval.ts
 */
import {
  nextBestAction,
  rankActions,
  cappedAlumniIds,
  OUTREACH_PER_DAY_CAP,
  FOLLOWUP_STALE_DAYS,
  type ConnectionSignals,
  type ActionType,
} from '../../packages/shared/agent/nextBestAction';

// Fixed "now" so fixtures are deterministic.
const NOW = new Date('2026-06-03T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

function conn(p: Partial<ConnectionSignals>): ConnectionSignals {
  return {
    alumniId: p.alumniId ?? 'a',
    status: p.status ?? null,
    contacted: p.contacted ?? false,
    contactedAt: p.contactedAt ?? null,
    lastMessageAt: p.lastMessageAt ?? null,
    meetingAt: p.meetingAt ?? null,
    fitScore: p.fitScore ?? 50,
  };
}

// ─── 1. Action-selection fixtures ───────────────────────────────────────────
console.log('═══ action selection ═══');
const cases: Array<{ name: string; signals: ConnectionSignals; type: ActionType; compose?: string | null; reason?: string }> = [
  { name: 'uncontacted, no status → DRAFT_INTRO', signals: conn({}), type: 'DRAFT_INTRO', compose: 'introduction' },
  { name: "uncontacted, status 'interested' → DRAFT_INTRO", signals: conn({ status: 'interested' }), type: 'DRAFT_INTRO' },
  { name: 'contacted 2d ago, no reply → AWAIT', signals: conn({ contacted: true, lastMessageAt: daysAgo(2) }), type: 'AWAIT' },
  { name: `contacted ${FOLLOWUP_STALE_DAYS}d ago (boundary) → SEND_FOLLOWUP`, signals: conn({ contacted: true, lastMessageAt: daysAgo(FOLLOWUP_STALE_DAYS) }), type: 'SEND_FOLLOWUP', compose: 'follow_up' },
  { name: `contacted ${FOLLOWUP_STALE_DAYS - 1}d ago (just under) → AWAIT`, signals: conn({ contacted: true, lastMessageAt: daysAgo(FOLLOWUP_STALE_DAYS - 1) }), type: 'AWAIT' },
  { name: 'contacted 30d ago → SEND_FOLLOWUP', signals: conn({ contacted: true, lastMessageAt: daysAgo(30) }), type: 'SEND_FOLLOWUP' },
  { name: "status 'response_needed' → RESPOND", signals: conn({ status: 'response_needed', contacted: true, lastMessageAt: daysAgo(1) }), type: 'RESPOND', compose: 'follow_up' },
  { name: 'status awaiting_reply but no logged message, stale via implied-contact → SEND_FOLLOWUP', signals: conn({ status: 'awaiting_reply', contactedAt: daysAgo(9) }), type: 'SEND_FOLLOWUP' },
  { name: "meeting_scheduled + date → PREP_MEETING (timed)", signals: conn({ status: 'meeting_scheduled', meetingAt: daysAhead(2) }), type: 'PREP_MEETING', compose: null, reason: 'in 2 days' },
  { name: 'meeting_scheduled, no date → PREP_MEETING (untimed)', signals: conn({ status: 'meeting_scheduled' }), type: 'PREP_MEETING', reason: 'when you can' },
  { name: "status 'met' → SEND_THANKYOU", signals: conn({ status: 'met' }), type: 'SEND_THANKYOU', compose: 'thank_you' },
  { name: "status 'not_interested' → AWAIT (muted)", signals: conn({ status: 'not_interested', contacted: true }), type: 'AWAIT' },
  // GATE: a cron-sourced 'proposed' alum (uncontacted) must be AWAIT, NEVER DRAFT_INTRO:
  { name: "GATE: 'proposed' uncontacted → AWAIT, not DRAFT_INTRO", signals: conn({ status: 'proposed' }), type: 'AWAIT' },
  // Graceful degradation — engine works on reliable signals when status is missing/wrong:
  { name: 'null status but contacted+stale → SEND_FOLLOWUP (no status needed)', signals: conn({ status: null, contacted: true, lastMessageAt: daysAgo(10) }), type: 'SEND_FOLLOWUP' },
  { name: "inconsistent status 'interested' but contacted+stale → SEND_FOLLOWUP (reliable wins)", signals: conn({ status: 'interested', contacted: true, lastMessageAt: daysAgo(10) }), type: 'SEND_FOLLOWUP' },
  { name: 'contacted via contactedAt only (no messages), stale → SEND_FOLLOWUP', signals: conn({ contacted: true, contactedAt: daysAgo(9) }), type: 'SEND_FOLLOWUP' },
];
for (const tc of cases) {
  const a = nextBestAction(tc.signals, NOW);
  let ok = a.type === tc.type;
  if (ok && tc.compose !== undefined) ok = a.compose === tc.compose;
  if (ok && tc.reason !== undefined) ok = a.reason.includes(tc.reason);
  check(tc.name, ok, `got type=${a.type} compose=${a.compose} reason="${a.reason}"`);
}

// ─── 2. Ranking order ────────────────────────────────────────────────────────
console.log('\n═══ ranking order ═══');
const mixed: ConnectionSignals[] = [
  conn({ alumniId: 'followup', contacted: true, lastMessageAt: daysAgo(10) }), // SEND_FOLLOWUP (50)
  conn({ alumniId: 'intro', fitScore: 50 }),                                    // DRAFT_INTRO (60)
  conn({ alumniId: 'respond', status: 'response_needed', contacted: true }),            // RESPOND (100)
  conn({ alumniId: 'meeting', status: 'meeting_scheduled', meetingAt: daysAhead(1) }), // PREP_MEETING (90)
  conn({ alumniId: 'thanks', status: 'met' }),                                  // SEND_THANKYOU (80)
];
const order = rankActions(mixed, NOW).today.map((a) => a.alumniId);
check('priority order respond>meeting>thanks>intro>followup',
  JSON.stringify(order) === JSON.stringify(['respond', 'meeting', 'thanks', 'intro', 'followup']),
  `got ${JSON.stringify(order)}`);

// Tie-break by fit score within the same action type.
const tie = rankActions([
  conn({ alumniId: 'lo', fitScore: 30 }),
  conn({ alumniId: 'hi', fitScore: 90 }),
], NOW).today.map((a) => a.alumniId);
check('tie-break: higher fit first', JSON.stringify(tie) === JSON.stringify(['hi', 'lo']), `got ${JSON.stringify(tie)}`);

// ─── 3. Per-day outreach cap ────────────────────────────────────────────────
console.log('\n═══ per-day outreach cap ═══');
const manyIntros: ConnectionSignals[] = Array.from({ length: 8 }, (_, i) =>
  conn({ alumniId: `intro${i}`, fitScore: i }), // all DRAFT_INTRO, ascending fit
);
const capped = rankActions(manyIntros, NOW); // cap = 5
check(`outreach capped at ${OUTREACH_PER_DAY_CAP} in today`, capped.today.length === OUTREACH_PER_DAY_CAP, `today=${capped.today.length}`);
check('overflow outreach goes to later', capped.later.length === 8 - OUTREACH_PER_DAY_CAP, `later=${capped.later.length}`);
check('capped "today" are the highest-fit', capped.today.every((a) => Number(a.alumniId.replace('intro', '')) >= 3), `today=${capped.today.map((a) => a.alumniId)}`);

// Reactions are NOT capped, even past the outreach ceiling.
const reactionsPlusOutreach: ConnectionSignals[] = [
  ...Array.from({ length: 6 }, (_, i) => conn({ alumniId: `intro${i}`, fitScore: i })), // 6 DRAFT_INTRO
  conn({ alumniId: 'r1', status: 'response_needed', contacted: true }),
  conn({ alumniId: 'r2', status: 'response_needed', contacted: true }),
];
const mix2 = rankActions(reactionsPlusOutreach, NOW);
check('reactions never capped: 2 RESPOND + 5 capped outreach = 7 today',
  mix2.today.length === 7 && mix2.today.filter((a) => a.type === 'RESPOND').length === 2,
  `today=${mix2.today.length} respond=${mix2.today.filter((a) => a.type === 'RESPOND').length}`);
check('1 outreach overflowed to later', mix2.later.length === 1, `later=${mix2.later.length}`);

// ─── 4. not_interested excluded from actionable buckets ─────────────────────
console.log('\n═══ exclusions ═══');
const withClosed = rankActions([
  conn({ alumniId: 'open' }),
  conn({ alumniId: 'closed', status: 'not_interested', contacted: true }),
], NOW);
check('not_interested in waiting, not today/later',
  withClosed.waiting.some((a) => a.alumniId === 'closed') &&
  !withClosed.today.some((a) => a.alumniId === 'closed') &&
  !withClosed.later.some((a) => a.alumniId === 'closed'),
  `today=${withClosed.today.map((a) => a.alumniId)} waiting=${withClosed.waiting.map((a) => a.alumniId)}`);

// GATE: a 'proposed' (cron-sourced, unapproved) alum must NEVER reach today/later.
const withProposed = rankActions([
  conn({ alumniId: 'live', status: 'interested' }),        // DRAFT_INTRO → today
  conn({ alumniId: 'sourced', status: 'proposed' }),       // gated → must NOT be outreach
], NOW);
check('proposed alum never in today/later (who-to-contact gate holds)',
  !withProposed.today.some((a) => a.alumniId === 'sourced') &&
  !withProposed.later.some((a) => a.alumniId === 'sourced'),
  `today=${withProposed.today.map((a) => a.alumniId)} later=${withProposed.later.map((a) => a.alumniId)}`);

// ─── 5. dismiss / snooze overrides (Checkpoint A behavior, DB-free) ─────────
console.log('\n═══ overrides (dismiss / snooze) ═══');
const intro = conn({ alumniId: 'x' }); // → DRAFT_INTRO
const dismissed = rankActions([intro], NOW, [
  { alumniId: 'x', actionType: 'DRAFT_INTRO', state: 'dismissed', snoozeUntil: null },
]);
check('dismissed override removes the action entirely',
  dismissed.today.length === 0 && dismissed.later.length === 0 && dismissed.waiting.length === 0,
  `today=${dismissed.today.length} waiting=${dismissed.waiting.length}`);

const snoozedActive = rankActions([intro], NOW, [
  { alumniId: 'x', actionType: 'DRAFT_INTRO', state: 'snoozed', snoozeUntil: daysAhead(2) },
]);
check('snooze with future snoozeUntil hides the action', snoozedActive.today.length === 0, `today=${snoozedActive.today.length}`);

const snoozeExpired = rankActions([intro], NOW, [
  { alumniId: 'x', actionType: 'DRAFT_INTRO', state: 'snoozed', snoozeUntil: daysAgo(1) },
]);
check('snooze past snoozeUntil → action reappears', snoozeExpired.today.length === 1, `today=${snoozeExpired.today.length}`);

const wrongType = rankActions([intro], NOW, [
  { alumniId: 'x', actionType: 'SEND_FOLLOWUP', state: 'dismissed', snoozeUntil: null },
]);
check('override only matches its own action_type', wrongType.today.length === 1, `today=${wrongType.today.length}`);

// ─── 6. cross-user ledger cap (the FATAL over-fishing invariant) ────────────
console.log('\n═══ cross-user ledger cap ═══');
check('alum contacted by 2 distinct users → capped (max 2)',
  cappedAlumniIds([{ alumni_id: 'a', user_id: 'u1' }, { alumni_id: 'a', user_id: 'u2' }], 2).includes('a'));
check('alum contacted by 1 user → NOT capped',
  cappedAlumniIds([{ alumni_id: 'a', user_id: 'u1' }], 2).length === 0);
check('same user contacting twice counts once → NOT capped',
  cappedAlumniIds([{ alumni_id: 'a', user_id: 'u1' }, { alumni_id: 'a', user_id: 'u1' }], 2).length === 0);
check('cap excludes ONLY the over-fished alum',
  JSON.stringify(cappedAlumniIds([{ alumni_id: 'a', user_id: 'u1' }, { alumni_id: 'a', user_id: 'u2' }, { alumni_id: 'b', user_id: 'u1' }], 2)) === JSON.stringify(['a']));
check('cap=3 not tripped by only 2 users (window/threshold respected)',
  cappedAlumniIds([{ alumni_id: 'a', user_id: 'u1' }, { alumni_id: 'a', user_id: 'u2' }], 3).length === 0);

// ─── summary ─────────────────────────────────────────────────────────────────
console.log(`\n═══ Checkpoint B: ${pass} passed, ${fail} failed ═══`);
if (fail > 0) process.exit(1);
console.log('PASS — Next Best Action engine green.');
