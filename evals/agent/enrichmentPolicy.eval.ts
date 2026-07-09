/**
 * Alumni freshness-engine policy eval — locks the fill-vs-refresh decision and the
 * incremental priority ordering. Pure logic, no LLM, no I/O.
 *
 * Run from apps/web:  npx tsx ../../evals/agent/enrichmentPolicy.eval.ts
 */
import {
  decideField,
  enrichmentPriority,
  FILL_MIN_CONFIDENCE,
  REFRESH_MIN_CONFIDENCE,
  REFRESH_STALE_DAYS,
} from '../../apps/web/lib/agent/enrichmentPolicy'

let pass = 0, fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log('  ✓', name) }
  else { fail++; console.log('  ✗ FAIL:', name) }
}

console.log('═══ fill mode ═══')
check('fill empty, high conf → write',
  decideField(null, 'Goldman Sachs', 0.9, 'fill', 9999).write === true)
check('fill empty, below bar → no write',
  decideField(null, 'Goldman Sachs', FILL_MIN_CONFIDENCE - 0.01, 'fill', 9999).write === false)
check('fill mode never overwrites an existing value',
  decideField('Morgan Stanley', 'Goldman Sachs', 0.99, 'fill', 9999).write === false)
check('no inference → no write',
  decideField(null, null, 0.99, 'fill', 9999).write === false)
check('blank inference → no write',
  decideField(null, '   ', 0.99, 'fill', 9999).write === false)

console.log('═══ refresh mode ═══')
check('refresh stale + high conf → write',
  decideField('Old Corp', 'New Corp', REFRESH_MIN_CONFIDENCE, 'refresh', REFRESH_STALE_DAYS + 1).write === true)
check('refresh stale but low conf → no write (never overwrite good data with a worse guess)',
  decideField('Old Corp', 'New Corp', REFRESH_MIN_CONFIDENCE - 0.01, 'refresh', REFRESH_STALE_DAYS + 1).write === false)
check('refresh not stale yet → no write',
  decideField('Old Corp', 'New Corp', 0.99, 'refresh', REFRESH_STALE_DAYS - 1).write === false)
check('refresh unchanged value → no write',
  decideField('Goldman Sachs', 'goldman sachs', 0.99, 'refresh', 9999).write === false)
check('refresh still fills an empty field at the lower fill bar',
  decideField(null, 'Goldman Sachs', FILL_MIN_CONFIDENCE, 'refresh', 0).write === true)

console.log('═══ incremental priority ═══')
const now = Date.parse('2026-07-01T00:00:00Z')
const iso = (d: number) => new Date(now - d * 86_400_000).toISOString()
const bothMissing = enrichmentPriority({ role: null, company: null, enriched_at: iso(1) }, now)
const oneMissing  = enrichmentPriority({ role: 'Analyst', company: null, enriched_at: iso(1) }, now)
const completeOld = enrichmentPriority({ role: 'Analyst', company: 'GS', enriched_at: iso(900) }, now)
const completeNew = enrichmentPriority({ role: 'Analyst', company: 'GS', enriched_at: iso(1) }, now)
const neverEnriched = enrichmentPriority({ role: 'Analyst', company: 'GS', enriched_at: null }, now)
check('more-missing outranks less-missing', bothMissing > oneMissing)
check('any-missing outranks complete', oneMissing > completeOld)
check('among complete, stalest outranks freshest', completeOld > completeNew)
check('never-enriched is treated as very stale', neverEnriched > completeOld)

console.log(`\n═══ enrichment policy: ${pass} passed, ${fail} failed ═══`)
if (fail > 0) { console.log('FAIL'); process.exit(1) }
console.log('PASS — freshness-engine policy green.')
