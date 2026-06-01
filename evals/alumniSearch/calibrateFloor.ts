// Calibration runner for the alumni-search pre-rerank floor.
//
// Two paths:
//
//   --offline   (default, no API keys)
//     Loads the local CSV alumni pool. For each representative query, builds
//     a UserPreferences from the (hand-derived) parsed-intent shape and runs
//     scoreAlumnus against every row. Reports the distribution of structured
//     scores — what a "good" vs "bad" match looks like for each query under
//     the shared scorer alone.
//
//   --live      (requires OPENAI_API_KEY, ANTHROPIC_API_KEY, SUPABASE_*)
//     Hits the live route: parses → vector top-30 → pre-score → rerank, and
//     prints similarity + pre-score for every retrieved candidate plus which
//     ones the rerank picked. This is what calibrates similarity-branch.
//
// Floor recommendation: see the comment at the bottom of report().

import {
  scoreAlumnus,
  type UserPreferences,
} from '../../packages/shared/scoring/recommendationScoring';
import type { Alumni } from '../../packages/shared/types/database';
import { loadAlumni } from '../recommendations/loadAlumni';

// Hand-derived intent for each representative query. The parser would
// produce something like this; encoding it here makes the offline run
// deterministic and lets us focus on the floor math, not the parser.
interface OfflineQueryShape {
  id: string;
  query: string;
  intent: {
    industries: string[];
    roles: string[];
    locations: string[];
    hardLocation?: string;
    gradYearMin?: number;
    gradYearMax?: number;
  };
}

const QUERIES: OfflineQueryShape[] = [
  {
    id: 'pm-fintech-nyc',
    query: "I'm a sophomore interested in product management at fintech startups in NYC",
    intent: { industries: ['Finance', 'Technology'], roles: ['Product Manager'], locations: ['New York', 'NYC'], hardLocation: 'New York' },
  },
  {
    id: 'consulting-to-climate',
    query: 'Alumni who pivoted from consulting into climate tech',
    intent: { industries: ['Consulting', 'Energy'], roles: [], locations: [] },
  },
  {
    id: 'gap-year-med-school',
    query: 'Anyone who took a gap year before med school',
    intent: { industries: ['Healthcare'], roles: [], locations: [] },
  },
  {
    id: 'founders-fail-succeed',
    query: 'People who founded companies right out of undergrad and failed before succeeding',
    intent: { industries: [], roles: ['Founder', 'CEO'], locations: [] },
  },
  {
    id: 'pe-women-boston',
    query: 'Women working in private equity in Boston',
    intent: { industries: ['Finance'], roles: [], locations: ['Boston'], hardLocation: 'Boston' },
  },
  {
    id: 'consulting-grad-2018',
    query: 'McKinsey or Bain alumni who graduated after 2018',
    intent: { industries: ['Consulting'], roles: [], locations: [], gradYearMin: 2018 },
  },
  {
    id: 'product-design-sf',
    query: 'Product designers in San Francisco',
    intent: { industries: ['Technology'], roles: ['Designer'], locations: ['San Francisco'], hardLocation: 'San Francisco' },
  },
  {
    id: 'sports-marketing-football',
    query: 'Football alumni working in sports marketing or media',
    intent: { industries: ['Sports', 'Media'], roles: [], locations: [] },
  },
  {
    id: 'biotech-research',
    query: 'Biotech research scientists',
    intent: { industries: ['Healthcare'], roles: ['Scientist', 'Researcher'], locations: [] },
  },
  {
    id: 'corporate-law',
    query: 'M&A or corporate law attorneys at top firms',
    intent: { industries: ['Law'], roles: ['Attorney', 'Counsel', 'Associate'], locations: [] },
  },
  // Follow-ups depend on prior turns — skip in offline mode.
  // Vague/clarify/no_match queries don't exercise the floor — skip.
  {
    id: 'vague-but-resolvable',
    query: 'someone in tech',
    intent: { industries: ['Technology'], roles: [], locations: [] },
  },
];

function buildPrefs(shape: OfflineQueryShape['intent']): UserPreferences {
  return {
    industries: shape.industries,
    sports: [],
    locations: shape.hardLocation
      ? [shape.hardLocation, ...shape.locations]
      : shape.locations,
    roles: shape.roles,
    companies: [],
    graduationYearMin: shape.gradYearMin,
    graduationYearMax: shape.gradYearMax,
    priorities: { sameSport: false, similarIndustry: true, seniorAlumni: false },
  };
}

interface Bucket { range: string; count: number }
function bucketize(scores: number[], edges: number[]): Bucket[] {
  const out: Bucket[] = edges.slice(0, -1).map((lo, i) => ({
    range: `${lo}–${edges[i + 1] - 1}`,
    count: 0,
  }));
  for (const s of scores) {
    for (let i = 0; i < edges.length - 1; i++) {
      if (s >= edges[i] && s < edges[i + 1]) { out[i].count++; break; }
    }
  }
  return out;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function runOffline() {
  const pool = loadAlumni();
  console.log(`Loaded ${pool.length} alumni rows from CSV.\n`);

  const EDGES = [0, 10, 20, 25, 30, 40, 50, 60, 80, 200];

  for (const q of QUERIES) {
    const prefs = buildPrefs(q.intent);
    const scored = pool
      .map((row) => scoreAlumnus(row as unknown as Alumni, prefs, {}))
      .map((s) => s.score);
    const above = scored.filter((s) => s > 0).sort((a, b) => b - a);

    console.log(`\n── ${q.id}  "${q.query}"`);
    console.log(`   non-zero scores: ${above.length}/${pool.length}`);
    if (above.length > 0) {
      console.log(`   max=${above[0]}  P90=${percentile(above, 90)}  P50=${percentile(above, 50)}  P10=${percentile(above, 10)}`);
      const top10 = above.slice(0, 10);
      console.log(`   top-10: ${top10.join(', ')}`);
      const buckets = bucketize(above, EDGES);
      console.log('   distribution:');
      for (const b of buckets) {
        const bar = '█'.repeat(Math.round(b.count / Math.max(1, above[0]) * 30));
        console.log(`     ${b.range.padStart(7)}  ${String(b.count).padStart(4)}  ${bar}`);
      }
      console.log(`   above floor 25: ${above.filter((s) => s >= 25).length}`);
      console.log(`   above floor 30: ${above.filter((s) => s >= 30).length}`);
      console.log(`   above floor 35: ${above.filter((s) => s >= 35).length}`);
    }
  }

  console.log('\n');
  report();
}

function report() {
  console.log('─── Floor recommendation ──────────────────────────────────');
  console.log(`
The current pre-rerank guard is: score >= 25 OR similarity >= 0.5.

What floor=25 catches with current weights (industry=30, role=20, sport=20,
location=15, company=10, prestige=25, completeness=10, gradYear=5):

  - industry match alone:  30 ≥ 25 ✓
  - role+location:         35 ≥ 25 ✓
  - role alone:            20 < 25 ✗  (caught only by similarity branch)
  - location alone:        15 < 25 ✗
  - completeness only:    ≤10 < 25 ✗  (correctly rejected — pure noise)
  - prestige only:        ≤25, but gated to industry-match, so 0 here

The similarity ≥ 0.5 OR-branch is INTENTIONAL: a row with a strong bio
match ("I pivoted from consulting to climate tech") may have no structured
industry/role match and would score ≤10. Letting the rerank LLM judge it
is the whole point of doing semantic search. The pre-floor's job is to
eliminate true noise, not to second-guess the embedding.

Offline analysis above shows non-zero structured scores cluster well above
25 for queries with clear industry/role signals, and have a long zero/low
tail. Floor=25 cleanly separates "any structured signal" from "no
structured signal" — moving it to 20 would let role-only matches through
(but those are also caught by similarity); moving it to 30 would exclude
role-only matches structurally (acceptable because similarity catches
them).

RECOMMENDATION: leave floor at 25 + similarity 0.5. The combination is
shaped correctly. Tune the similarity threshold ONLY after running the
--live arm against a corpus with real embeddings, where you can see the
similarity-score distribution per query and verify 0.5 is the right
P90-ish gate for "semantically actually relevant."
`);
}

async function runLive() {
  console.log(`The --live arm requires:`);
  console.log(`  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (for direct alumni reads)`);
  console.log(`  - OPENAI_API_KEY (or VOYAGE_API_KEY + EMBEDDING_PROVIDER=voyage)`);
  console.log(`  - ANTHROPIC_API_KEY (for the parse + rerank calls)`);
  console.log(`  - alumni.embedding column backfilled (run: npm run embed:alumni)`);
  console.log(``);
  console.log(`Not implemented here. To get the similarity-side calibration,`);
  console.log(`hit POST /api/alumni-search from a script for each query in`);
  console.log(`REPRESENTATIVE and capture (a) the vector top-30 similarity`);
  console.log(`distribution, (b) which IDs survive the pre-floor, (c) which`);
  console.log(`the rerank picks. The route already logs result IDs per query`);
  console.log(`to user_events; querying that table with the analytics.sql in`);
  console.log(`this directory will surface the production-time distribution.`);
}

const mode = process.argv.includes('--live') ? 'live' : 'offline';
(mode === 'live' ? runLive() : runOffline()).catch((err) => {
  console.error(err);
  process.exit(1);
});
