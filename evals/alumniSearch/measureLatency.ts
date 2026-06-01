/**
 * Latency measurement for the alumni-search pipeline.
 *
 * Runs each representative query through POST /api/alumni-search, records
 * wall-clock time end-to-end, and reports P50/P95.
 *
 * Requirements:
 *   - SEARCH_BASE_URL (e.g. http://localhost:3000 or staging URL)
 *   - SEARCH_SESSION_TOKEN (Supabase access_token of a user in the treatment
 *     arm — `select auth.sign_in_with_password` from a test account, or
 *     copy from a logged-in browser session's storage)
 *
 * Caveat: this measures the FULL pipeline (parse + retrieve + rerank +
 * hydrate + log), not just the rerank. To isolate rerank latency, add a
 * `X-Debug-Timings: 1` header support to the route and emit per-stage
 * timings in the response — kept out of this script to keep the measurement
 * harness lean.
 *
 * Target: full pipeline P95 < 3000ms.
 * Decision rule: if rerank consistently dominates (the route-side timing
 * would tell you), set RERANK_MODEL=claude-sonnet-4-6 only if Haiku quality
 * is the issue. Sonnet is roughly 2× slower at this input size; switching
 * for latency alone is the wrong move.
 */

import { REPRESENTATIVE } from './queries';

const BASE_URL = process.env.SEARCH_BASE_URL ?? 'http://localhost:3000';
const TOKEN = process.env.SEARCH_SESSION_TOKEN;

if (!TOKEN) {
  console.error('Missing SEARCH_SESSION_TOKEN. Copy from a logged-in browser session.');
  process.exit(1);
}

interface Sample { id: string; ms: number; ok: boolean; matchCount: number }

async function runOne(query: string): Promise<{ ms: number; ok: boolean; matchCount: number }> {
  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}/api/alumni-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query, history: [] }),
  });
  const ms = performance.now() - t0;
  if (!res.ok) return { ms, ok: false, matchCount: 0 };
  const json = await res.json();
  return { ms, ok: true, matchCount: Array.isArray(json.matches) ? json.matches.length : 0 };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  const REPEATS = 3; // run each query 3× to dampen first-call cold-cache effects
  const samples: Sample[] = [];

  for (const tc of REPRESENTATIVE) {
    // Skip the follow-up tests that require prior history.
    if (tc.id === 'narrow-followup-boston' || tc.id === 'exclude-consultants') continue;

    for (let i = 0; i < REPEATS; i++) {
      const { ms, ok, matchCount } = await runOne(tc.query);
      samples.push({ id: `${tc.id}#${i}`, ms, ok, matchCount });
      console.log(`  ${tc.id}#${i}  ${ms.toFixed(0)}ms  ok=${ok}  matches=${matchCount}`);
    }
  }

  const ok = samples.filter((s) => s.ok).map((s) => s.ms);
  const failed = samples.filter((s) => !s.ok);

  console.log('\n── Summary ───────────────────────────────────');
  console.log(`samples=${samples.length}  ok=${ok.length}  failed=${failed.length}`);
  if (ok.length === 0) return;
  console.log(`P50: ${percentile(ok, 50).toFixed(0)}ms`);
  console.log(`P95: ${percentile(ok, 95).toFixed(0)}ms`);
  console.log(`max: ${Math.max(...ok).toFixed(0)}ms`);

  const target = 3000;
  const p95 = percentile(ok, 95);
  console.log(`\nTarget: P95 < ${target}ms — ${p95 < target ? 'PASS' : 'FAIL'}`);
  if (p95 >= target) {
    console.log(`→ Investigate per-stage timing. If rerank dominates and Haiku quality is fine,`);
    console.log(`  the right move is reducing candidate pool size (currently 12), not switching models.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
