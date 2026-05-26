// Eval driver. Runs the REAL recommendation engine (selectRecommendations from
// apps/mobile/src/services/recommendationScoring.ts) over the production import
// dataset for each seeker, writes per-seeker results + a summary, and returns
// the aggregate so the entrypoint can print/compare.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAlumni, type EvalAlumni } from './loadAlumni';
import { SEEKERS } from './seekers';
import { aggregate, evaluateSeeker, type Aggregate, type SeekerMetrics } from './metrics';
import {
  deriveTargetDbIndustries,
  selectRecommendations,
} from '@scout/shared/scoring/recommendationScoring';

const TOP_N = 10;

// Reproduce fetchRecommendations' two DB queries over the in-memory pool.
function buildPasses(pool: EvalAlumni[], industries: string[]) {
  const targets = deriveTargetDbIndustries(industries);
  const targetSet = new Set(targets); // Postgres .in() is exact-match
  const pass1 = targets.length
    ? pool.filter((a) => a.is_public && a.industry !== null && targetSet.has(a.industry))
    : [];
  // Pass 2: prestige_score DESC (stable), capped at 500 — mirrors the DB query.
  const pass2 = [...pool]
    .filter((a) => a.is_public)
    .sort((a, b) => b.prestige_score - a.prestige_score)
    .slice(0, 500);
  return { pass1, pass2 };
}

export function runEval(label: string): { aggregate: Aggregate; metrics: SeekerMetrics[] } {
  const pool = loadAlumni();
  const outDir = join(__dirname, label);
  mkdirSync(outDir, { recursive: true });

  const metrics: SeekerMetrics[] = [];

  for (const seeker of SEEKERS) {
    const { pass1, pass2 } = buildPasses(pool, seeker.prefs.industries);
    const results = selectRecommendations({
      pass1: pass1 as any,
      pass2: pass2 as any,
      excludeIds: new Set<string>(),
      prefs: seeker.prefs,
      swipeWeights: {},
      limit: TOP_N,
    });

    const m = evaluateSeeker(seeker, results as any);
    metrics.push(m);

    writeFileSync(
      join(outDir, `${seeker.id}.json`),
      JSON.stringify(
        {
          seeker: { id: seeker.id, field: seeker.field, note: seeker.note, prefs: seeker.prefs, expectedIndustries: seeker.expectedIndustries },
          metrics: m,
          results: (results as any[]).map((r, rank) => ({
            rank: rank + 1,
            name: r.full_name,
            industry: r.industry,
            company: r.company,
            role: r.role,
            sport: r.sport,
            graduation_year: r.graduation_year,
            prestige_score: r.prestige_score,
            score: r.score,
            breakdown: r.scoreBreakdown,
            whyThisMatch: r.whyThisMatch,
          })),
        },
        null,
        2,
      ),
    );
  }

  const agg = aggregate(label, metrics);
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ aggregate: agg, metrics }, null, 2));
  return { aggregate: agg, metrics };
}
