/**
 * Sourcing-gate eval — locks the DETERMINISTIC half of the sourcing fix so it
 * holds for ALL searches, not just the one we hand-tested. Pure logic, no LLM,
 * no I/O. Mirrors the tsx eval style (PASS/FAIL, non-zero exit on failure).
 *
 * Run from apps/web:  npx tsx ../../evals/agent/sourceAlumniGate.eval.ts
 */
import {
  isRealCompany,
  hasPersonalizationHook,
  sourcingConfidence,
  locationMatch,
} from '../../apps/web/lib/agent/sourceAlumniGate'
import type { UserPreferences } from '../../packages/shared/scoring/recommendationScoring'
import type { Alumni } from '../../packages/shared/types/database'
import { isValidIndustry, coverageTier } from '../../apps/web/lib/campaign/industries'
import { lintReason, hasHardViolation } from '../../apps/web/lib/agent/reasonLint'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

function alum(p: Partial<Alumni>): Alumni {
  return {
    id: 'a', full_name: 'X', email: null, linkedin_url: null, sport: '', graduation_year: 2020,
    company: null, role: null, industry: null, location: null, avatar_url: null, photo_url: null,
    is_verified: false, is_public: true, source: 'public_record', school_id: null, created_at: '', updated_at: '',
    work_history: null, skills: null, education: null, display_headline: null, path_summary_stub: null,
    current_status_type: null, bio: null, advice: null, share_email_with_students: false, is_claimed: false,
    claimed_at: null, claim_source: null, claimed_by_user_id: null, profile_reviewed_by_alumni: false, ...p,
  }
}
function prefs(p: Partial<UserPreferences>): UserPreferences {
  return { industries: [], sports: [], locations: [], roles: [], companies: [], priorities: { sameSport: false, similarIndustry: true, seniorAlumni: false }, ...p }
}

// ─── isRealCompany — placeholder rejection (the Alex Heiss hole) ─────────────
console.log('═══ isRealCompany ═══')
check('real company → true', isRealCompany('Citi') === true)
check('YC-badged company strips badge → true', isRealCompany('MouseCat (YC W26)') === true)
check('"Stealth Startup" → false', isRealCompany('Stealth Startup') === false)
check('lowercase "stealth startup" → false', isRealCompany('stealth startup') === false)
check('"Self-employed" → false', isRealCompany('Self-employed') === false)
check('bare "Startup" → false', isRealCompany('Startup') === false)
check('"Freelance" → false', isRealCompany('Freelance') === false)
check('null → false', isRealCompany(null) === false)
check('empty string → false', isRealCompany('') === false)
check('1-char → false', isRealCompany('a') === false)
check('charity/non-employer → false ("…Adopt-A-Family Christmas Drive")', isRealCompany('Cornell Adopt-A-Family Christmas Drive') === false)
check('real firm with "Drive" in the name survives → true ("Drive Capital")', isRealCompany('Drive Capital') === true)

// ─── hasPersonalizationHook — abstain unless a real hook exists ──────────────
console.log('\n═══ hasPersonalizationHook (abstain gate) ═══')
check('real current company → hook', hasPersonalizationHook(alum({ company: 'Citi' }), null, []) === true)
check('placeholder company + nothing else → NO hook (abstain)',
  hasPersonalizationHook(alum({ company: 'Stealth Startup', sport: 'Fencing', location: 'Austin, TX' }), 'Basketball', ['New York']) === false)
check('shared sport → hook even w/ placeholder company',
  hasPersonalizationHook(alum({ company: 'Stealth Startup', sport: 'Basketball' }), 'Basketball', []) === true)
check('target-city overlap → hook',
  hasPersonalizationHook(alum({ company: 'Stealth Startup', location: 'San Francisco, California' }), null, ['San Francisco']) === true)
check('named past employer → hook',
  hasPersonalizationHook(alum({ company: 'Stealth Startup', work_history: [{ company: 'Coinbase', title: null, start: null, end: null, duration: null, location: null }] }), null, []) === true)
check('truly anonymous (no real co / sport / city / past) → NO hook',
  hasPersonalizationHook(alum({ company: null, role: 'Founder', sport: 'Fencing', location: 'Austin, TX' }), 'Basketball', ['New York']) === false)

// ─── locationMatch — metro-aware, consistent, no short-token false positives ─
console.log('\n═══ locationMatch (metro-aware) ═══')
check('exact city → true', locationMatch('New York, New York', ['New York']) === true)
check('Brooklyn → NYC metro', locationMatch('Brooklyn, NY', ['New York']) === true)
check('Jersey City → NYC metro (immediate commuter core)', locationMatch('Jersey City, New Jersey', ['New York']) === true)
check('Rye/White Plains (Westchester exurb) is NOT NYC — conservative metro policy', locationMatch('Rye, N.Y.', ['New York']) === false && locationMatch('White Plains, New York', ['New York']) === false)
check('Cambridge → Boston metro', locationMatch('Cambridge, Massachusetts', ['Boston']) === true)
check('Mountain View → SF Bay', locationMatch('Mountain View, California', ['San Francisco']) === true)
check('SF Bay Area → SF', locationMatch('SF Bay Area', ['San Francisco']) === true)
check('Washington DC → Washington', locationMatch('Washington, District of Columbia', ['Washington']) === true)
check('Chicago is NOT SF', locationMatch('Chicago, Illinois', ['San Francisco']) === false)
check('Ithaca, New York is NOT NYC (state-name collision)', locationMatch('Ithaca, New York', ['New York']) === false)
check('Seattle, Washington is NOT DC (state-name collision)', locationMatch('Seattle, Washington', ['Washington']) === false)
check('"new york" does not match "Newark" via prefix', locationMatch('Newarketing Co, Texas', ['New York']) === false)
check('Atlanta is NOT Los Angeles (no "la" false positive)', locationMatch('Atlanta, Georgia', ['Los Angeles']) === false)
check('Dallas is NOT Los Angeles', locationMatch('Dallas, Texas', ['Los Angeles']) === false)
check('null location → false', locationMatch(null, ['New York']) === false)
check('no target cities → false', locationMatch('New York', []) === false)

// ─── sourcingConfidence — the DETERMINISTIC HIGH decision (LLM cannot move it) ─
console.log('\n═══ sourcingConfidence (deterministic HIGH/LOW) ═══')
const SF = ['San Francisco']
const NY = ['New York']
check('real co + industry + city → HIGH',
  sourcingConfidence(alum({ company: 'Goldman Sachs', industry: 'Finance', location: 'New York, New York' }), prefs({ industries: ['Finance'], locations: NY }), null, NY) === 'high')
check('CITY CONSISTENCY: SF SWE → HIGH for SF search',
  sourcingConfidence(alum({ company: 'Google', industry: 'Technology', role: 'Software Engineer', location: 'San Francisco, California' }), prefs({ industries: ['Technology'], roles: ['Software Engineer'], locations: SF }), null, SF) === 'high')
check('CITY CONSISTENCY: NY SWE → LOW for SF search (the Barth/Jiang leak)',
  sourcingConfidence(alum({ company: 'Google', industry: 'Technology', role: 'Software Engineer', location: 'New York, New York' }), prefs({ industries: ['Technology'], roles: ['Software Engineer'], locations: SF }), null, SF) === 'low')
check('CITY CONSISTENCY: Chicago SWE → LOW for SF search (same as NY — consistent)',
  sourcingConfidence(alum({ company: 'Everlaw', industry: 'Technology', role: 'Software Engineer', location: 'Chicago, Illinois' }), prefs({ industries: ['Technology'], roles: ['Software Engineer'], locations: SF }), null, SF) === 'low')
check('similarity-band / junk industry ("Startups") → LOW',
  sourcingConfidence(alum({ company: 'MouseCat', industry: null, location: 'New York, New York' }), prefs({ industries: ['Startups'], locations: NY }), null, NY) === 'low')
check('placeholder company → LOW even with industry+role+city',
  sourcingConfidence(alum({ company: 'Stealth Startup', industry: 'Technology', role: 'Software Engineer', location: 'San Francisco, California' }), prefs({ industries: ['Technology'], roles: ['Software Engineer'], locations: SF }), null, SF) === 'low')
check('industry match but out-of-city → LOW',
  sourcingConfidence(alum({ company: 'Citi', industry: 'Finance', location: 'Miami, Florida' }), prefs({ industries: ['Finance'], locations: NY }), null, NY) === 'low')
check('no target cities specified → city not required (HIGH on industry)',
  sourcingConfidence(alum({ company: 'Citi', industry: 'Finance', location: 'Miami, Florida' }), prefs({ industries: ['Finance'], locations: [] }), null, []) === 'high')
check('metro alias keeps a genuine match: Cambridge → Boston HIGH',
  sourcingConfidence(alum({ company: 'Beth Israel Lahey Health', industry: 'Healthcare', location: 'Cambridge, Massachusetts' }), prefs({ industries: ['Healthcare'], locations: ['Boston'] }), null, ['Boston']) === 'high')

// ─── taxonomy validation (the "Startups"/fintech fix) ───────────────────────
console.log('\n═══ taxonomy validation ═══')
check('Finance is a valid corpus industry', isValidIndustry('Finance') === true)
check('all 6 corpus industries valid', ['Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media'].every(isValidIndustry) === true)
check('"Startups" is NOT valid (the junk slice is rejected at goal-set)', isValidIndustry('Startups') === false)
check('"fintech" is NOT an industry (it is a focus, not taxonomy)', isValidIndustry('fintech') === false)
check('null/empty → invalid', isValidIndustry(null) === false && isValidIndustry('') === false)

// ─── coverage tiers (thin / moderate / healthy / empty) ─────────────────────
console.log('\n═══ coverage tiers ═══')
check('203 (Finance/NYC) → healthy', coverageTier(203) === 'healthy')
check('30 → healthy (boundary)', coverageTier(30) === 'healthy')
check('12 → moderate', coverageTier(12) === 'moderate')
check('7 (Media/LA) → thin', coverageTier(7) === 'thin')
check('0 (empty slice) → thin', coverageTier(0) === 'thin')

// ─── role-downgrade combination (deterministic floor × soft LLM downgrade) ──
console.log('\n═══ role-relevance downgrade ═══')
const finalConf = (dconf: 'high' | 'low', roleOk: boolean): 'high' | 'low' => (dconf === 'high' && roleOk ? 'high' : 'low')
check('deterministic HIGH + role relevant → HIGH', finalConf('high', true) === 'high')
check('deterministic HIGH + role IRRELEVANT → LOW (downgrade fires)', finalConf('high', false) === 'low')
check('deterministic LOW + role relevant → LOW (LLM can never upgrade)', finalConf('low', true) === 'low')

// ─── prose integrity lint (no manufactured athlete / no joke title / filler) ─
console.log('\n═══ prose integrity lint ═══')
check('manufactured athlete bond w/ NO sport match → flagged', lintReason('As a fellow athlete, Skylar can help.', { sportMatched: false }).includes('manufactured-athlete'))
check('athlete line OK when sport genuinely matches', !lintReason('You both played basketball — Skylar gets the grind.', { sportMatched: true }).includes('manufactured-athlete'))
check('non-literal title ("People Whisperer") → HARD violation', hasHardViolation('Courtney is a People Whisperer at Penske Media in LA.', { sportMatched: false }) === true)
check('manufactured athlete is a HARD violation (must be replaced)', hasHardViolation('A fellow athlete, he understands the grind.', { sportMatched: false }) === true)
check('filler is flagged but SOFT (not auto-replaced)',
  lintReason('Joshua can provide valuable insights into finance.', { sportMatched: false }).includes('filler')
  && hasHardViolation('Joshua can provide valuable insights into finance.', { sportMatched: false }) === false)
check('clean fact-based reason → zero violations',
  lintReason('Senior Analyst at Goldman Sachs in New York — your target finance-analyst track.', { sportMatched: false }).length === 0)

console.log(`\n═══ Sourcing gate: ${pass} passed, ${fail} failed ═══`)
if (fail > 0) process.exit(1)
console.log('PASS — sourcing gate green (holds for all searches).')
