/**
 * Headless eval + latency runner for the alumni-search pipeline.
 *
 * Mirrors the orchestration in apps/web/app/api/alumni-search/route.ts
 * (parse → embed → match_alumni_semantic → pre-score → rerank) but runs it
 * directly against Supabase with the service-role key — no Next server, no
 * auth, no flag gate. It imports the REAL pipeline modules so it exercises the
 * actual prompts/models/scorer, not a copy.
 *
 * Graceful degradation by available keys:
 *   - OPENAI_API_KEY only        → privacy-exclusion test + retrieval smoke test
 *   - + ANTHROPIC_API_KEY        → full pipeline over all 20 cases + latency
 *
 * The Anthropic-backed modules are dynamically imported, because the SDK
 * throws at construction when no key is set — a static import would crash the
 * whole script before the OpenAI-only tests could run.
 *
 * Usage: npx tsx evals/alumniSearch/runEvals.ts
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { join } from 'node:path'
import { embedText } from '../../apps/web/lib/search/embeddings'
import { parseQuery } from '../../apps/web/lib/search/queryParse'
import { rerankCandidates } from '../../apps/web/lib/search/rerank'
import { scoreAlumnus, type UserPreferences } from '../../packages/shared/scoring/recommendationScoring'
import type { Alumni } from '../../packages/shared/types/database'
import { REPRESENTATIVE, ADVERSARIAL } from './queries'

config({ path: join(__dirname, '../../.env.local') })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing Supabase env'); process.exit(1) }
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

// Parse + rerank now run on OpenAI (see lib/search/llm.ts), same key as embeddings.
const HAS_LLM = !!process.env.OPENAI_API_KEY
const VECTOR_TOP_K = 30
const SCORE_FLOOR = 25
const SIM_FLOOR = Number(process.env.SIM_FLOOR ?? 0.30)

// ─── pref mapping (mirror of route.intentToPrefs) ───────────────────────────
function intentToPrefs(intent: any): UserPreferences {
  return {
    industries: intent.soft.industries,
    sports: [],
    locations: intent.hard.location ? [intent.hard.location, ...intent.soft.locations] : intent.soft.locations,
    roles: intent.soft.roles,
    companies: [],
    graduationYearMin: intent.hard.graduationYearMin,
    graduationYearMax: intent.hard.graduationYearMax,
    priorities: { sameSport: false, similarIndustry: true, seniorAlumni: false },
  }
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

interface Timings { parseMs: number; embedMs: number; rpcMs: number; scoreMs: number; rerankMs: number; totalMs: number }

// ─── full pipeline (parse → embed → rpc → pre-score → rerank) ───────────────
async function fullPipeline(query: string, history: string[]) {
  const t: Timings = { parseMs: 0, embedMs: 0, rpcMs: 0, scoreMs: 0, rerankMs: 0, totalMs: 0 }
  let s = performance.now()
  const intent = await parseQuery(query, history); t.parseMs = performance.now() - s

  if (intent.clarifyingQuestion) {
    t.totalMs = t.parseMs
    return { intent, matches: [] as any[], clarifying: intent.clarifyingQuestion as string, noMatch: null as string | null, t }
  }

  s = performance.now()
  let vec: number[]
  try { vec = await embedText(intent.searchPhrase) } catch (e: any) { return { error: 'embed failed: ' + e.message } }
  t.embedMs = performance.now() - s

  s = performance.now()
  const { data, error } = await sb.rpc('match_alumni_semantic', {
    query_embedding: vec, exclude_ids: [],
    location_q: null, // location is a soft signal — see route.ts rationale
    grad_year_min: intent.hard.graduationYearMin ?? null,
    grad_year_max: intent.hard.graduationYearMax ?? null,
    match_count: VECTOR_TOP_K,
  })
  t.rpcMs = performance.now() - s
  if (error) return { error: 'rpc: ' + error.message }
  const rows = (data ?? []) as any[]

  s = performance.now()
  const prefs = intentToPrefs(intent)
  const pre = rows
    .map((r) => ({ row: r, similarity: r.similarity ?? 0, score: scoreAlumnus(r as unknown as Alumni, prefs, {}).score }))
    .filter((c) => c.score >= SCORE_FLOOR || c.similarity >= SIM_FLOOR)
    .sort((a, b) => b.score - a.score || b.similarity - a.similarity)
    .slice(0, 12)
  t.scoreMs = performance.now() - s

  if (pre.length === 0) {
    t.totalMs = t.parseMs + t.embedMs + t.rpcMs + t.scoreMs
    return { intent, matches: [] as any[], clarifying: null, noMatch: `below floor — no candidate cleared score≥${SCORE_FLOOR} / sim≥${SIM_FLOOR}`, t }
  }

  s = performance.now()
  const rr = await rerankCandidates({
    userQuery: query, searchPhrase: intent.searchPhrase, themes: intent.soft.themes,
    candidates: pre.map((c) => ({
      id: c.row.id, full_name: c.row.full_name, sport: c.row.sport, graduation_year: c.row.graduation_year,
      company: c.row.company, role: c.row.role, industry: c.row.industry, location: c.row.location,
      bio: c.row.bio, display_headline: c.row.display_headline, preScore: c.score,
    })),
  })
  t.rerankMs = performance.now() - s
  t.totalMs = t.parseMs + t.embedMs + t.rpcMs + t.scoreMs + t.rerankMs

  const byId = new Map(rows.map((r) => [r.id, r]))
  const matches = rr.matches
    .map((m: any) => ({ id: m.alumnus_id, name: byId.get(m.alumnus_id)?.full_name, role: byId.get(m.alumnus_id)?.role, company: byId.get(m.alumnus_id)?.company, reasoning: m.reasoning }))
    .filter((m: any) => m.name)
  return { intent, matches, clarifying: rr.clarifying_question, noMatch: matches.length ? null : (rr.no_matches_reason ?? 'no matches'), t }
}

// ─── privacy exclusion test (OpenAI only, robust to index recall) ───────────
async function privacyTest() {
  // Seed a public twin and a private row with the SAME embedding so we can tell
  // "correctly excluded" from "just not retrieved." Query with that exact
  // embedding (distance 0). Expect: public twin present, private absent.
  const text = 'ZZEVAL Distinct Marker Person, Principal Widget Engineer at ZZEvalWidgetCo, Widgets, Nowhereville'
  let emb: number[]
  try { emb = await embedText(text) } catch (e: any) { return { verdict: 'INCONCLUSIVE', note: 'embed failed: ' + e.message } }

  const base = { sport: 'Tennis', graduation_year: 2015, role: 'Principal Widget Engineer', company: 'ZZEvalWidgetCo', industry: 'Widgets', location: 'Nowhereville', embedding: emb }
  const { data: ins, error: insErr } = await sb.from('alumni').insert([
    { ...base, full_name: 'ZZEVAL Public Twin', is_public: true },
    { ...base, full_name: 'ZZEVAL Private Hidden', is_public: false },
  ]).select('id, full_name, is_public')
  if (insErr || !ins) return { verdict: 'INCONCLUSIVE', note: 'could not seed: ' + (insErr?.message ?? 'no rows') }

  const publicId = ins.find((r) => r.is_public)?.id
  const privateId = ins.find((r) => !r.is_public)?.id

  try {
    const { data, error } = await sb.rpc('match_alumni_semantic', {
      query_embedding: emb, exclude_ids: [], location_q: null, grad_year_min: null, grad_year_max: null, match_count: 30,
    })
    if (error) return { verdict: 'INCONCLUSIVE', note: 'rpc err: ' + error.message }
    const ids = new Set((data ?? []).map((r: any) => r.id))
    const publicSeen = ids.has(publicId)
    const privateSeen = ids.has(privateId)
    if (privateSeen) return { verdict: 'FAIL', note: 'private (is_public=false) row LEAKED into results' }
    if (!publicSeen) return { verdict: 'INCONCLUSIVE', note: 'public twin not retrieved either — likely pre-REINDEX recall miss; re-run after REINDEX' }
    return { verdict: 'PASS', note: 'public twin returned, private row correctly excluded' }
  } finally {
    await sb.from('alumni').delete().in('id', [publicId, privateId].filter(Boolean) as string[])
  }
}

// ─── retrieval smoke test (OpenAI only) ─────────────────────────────────────
async function retrievalSmoke(phrase: string) {
  let vec: number[]
  try { vec = await embedText(phrase) } catch (e: any) { return { error: e.message } }
  const { data, error } = await sb.rpc('match_alumni_semantic', {
    query_embedding: vec, exclude_ids: [], location_q: null, grad_year_min: null, grad_year_max: null, match_count: 5,
  })
  if (error) return { error: error.message }
  return { rows: (data ?? []).map((r: any) => ({ name: r.full_name, role: r.role, company: r.company, industry: r.industry, sim: Number(r.similarity).toFixed(3) })) }
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`LLM (OpenAI ${process.env.SEARCH_LLM_MODEL ?? 'gpt-4o-mini'}): ${HAS_LLM ? 'present — running full pipeline' : 'MISSING'}`)
  console.log(`SIM_FLOOR=${SIM_FLOOR}  SCORE_FLOOR=${SCORE_FLOOR}\n`)

  // Always: privacy exclusion (most security-critical, OpenAI-only).
  console.log('═══ Adversarial: privacy exclusion (adv-discoverable-off) ═══')
  const priv = await privacyTest()
  console.log(`  ${priv.verdict}: ${priv.note}\n`)

  // Always: retrieval smoke on a few phrases.
  console.log('═══ Retrieval smoke (embed → RPC, no rerank) ═══')
  for (const phrase of ['product manager at a fintech startup', 'private equity investor in Boston', 'biotech research scientist']) {
    const r = await retrievalSmoke(phrase)
    console.log(`  "${phrase}"`)
    if (r.error) console.log(`    ERROR: ${r.error}`)
    else r.rows!.forEach((x) => console.log(`    ${x.sim}  ${x.name} — ${x.role ?? '—'} @ ${x.company ?? '—'} (${x.industry ?? '—'})`))
  }
  console.log()

  if (!HAS_LLM) {
    console.log('Full pipeline (parse + rerank) SKIPPED — set OPENAI_API_KEY to run the 15 representative + remaining adversarial cases and latency.')
    return
  }

  const rerankMsAll: number[] = []
  const totalMsAll: number[] = []

  // Follow-up cases need prior history; provide a sensible seed turn.
  const HISTORY: Record<string, string[]> = {
    'narrow-followup-boston': ['Alumni in private equity'],
    'exclude-consultants': ['Alumni who work in finance and consulting'],
  }

  for (const tc of [...REPRESENTATIVE, ...ADVERSARIAL]) {
    if (tc.id === 'adv-discoverable-off') continue // handled above
    const history = HISTORY[tc.id] ?? []
    const res: any = await fullPipeline(tc.query, history)
    console.log(`── [${tc.expected}] ${tc.id}: "${tc.query}"`)
    if (res.error) { console.log(`   ERROR: ${res.error}`); continue }
    if (res.clarifying) console.log(`   CLARIFY: ${res.clarifying}`)
    if (res.noMatch) console.log(`   NO_MATCH: ${res.noMatch}`)
    if (res.matches?.length) {
      res.matches.forEach((m: any) => console.log(`   • ${m.name} — ${m.role ?? '—'} @ ${m.company ?? '—'}\n     ${m.reasoning}`))
    }
    if (res.t) {
      console.log(`   t: parse=${res.t.parseMs.toFixed(0)} embed=${res.t.embedMs.toFixed(0)} rpc=${res.t.rpcMs.toFixed(0)} score=${res.t.scoreMs.toFixed(0)} rerank=${res.t.rerankMs.toFixed(0)} TOTAL=${res.t.totalMs.toFixed(0)}ms`)
      if (res.t.rerankMs > 0) rerankMsAll.push(res.t.rerankMs)
      totalMsAll.push(res.t.totalMs)
    }
    console.log()
  }

  console.log('═══ Latency ═══')
  console.log(`  rerank   P50=${percentile(rerankMsAll, 50).toFixed(0)}ms  P95=${percentile(rerankMsAll, 95).toFixed(0)}ms  (n=${rerankMsAll.length})`)
  console.log(`  pipeline P50=${percentile(totalMsAll, 50).toFixed(0)}ms  P95=${percentile(totalMsAll, 95).toFixed(0)}ms  (n=${totalMsAll.length})`)
  console.log(`  target: pipeline P95 < 3000ms — ${percentile(totalMsAll, 95) < 3000 ? 'PASS' : 'FAIL'}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
