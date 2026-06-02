# Alumni Search — Go-Live Checklist

Run top to bottom once the embeddings API key is available. No step requires
thinking; each has an exact command and a pass condition. Stop if a pass
condition fails.

**Current state (probed 2026-05-28):**
- Migration 023 is **NOT applied** — `alumni.embedding` column and
  `match_alumni_semantic` RPC are both absent.
- Production `alumni` table: **16,970 rows, all `is_public = true`.**
- `ALUMNI_SEARCH_ROLLOUT_PERCENT` = 10 (do not change until step 8).

---

## Step 1 — Apply migration 023

This environment has no `psql` / Supabase CLI / `pg`, and PostgREST can't run
DDL, so the migration must be applied by a human through one of:

- **Supabase Dashboard → SQL Editor** (no install): paste the full contents of
  `apps/web/supabase/migrations/023_alumni_embeddings.sql`, run.
- **Supabase CLI:** `supabase db push` (after `supabase link`).
- **psql:** `psql "$DIRECT_DB_URL" -f apps/web/supabase/migrations/023_alumni_embeddings.sql`

The migration is idempotent (`IF NOT EXISTS` / `OR REPLACE`) — safe to re-run.

## Step 2 — Verify migration objects

```
npx tsx evals/alumniSearch/verifyMigration.ts
```

Pass condition: all three of —
- `✓ alumni.embedding column: EXISTS. non-null embeddings: 0`
- `✓ match_alumni_semantic RPC: EXISTS`
- Then run the printed index query in SQL editor; expect one `ivfflat` row.

If the RPC shows NOT FOUND right after applying, reload the PostgREST schema
cache (Dashboard → API → "Reload schema", or `NOTIFY pgrst, 'reload schema';`).

## Step 3 — API key for web env

The whole feature now runs on OpenAI — embeddings AND the parse/rerank LLM
stages (see `lib/search/llm.ts`). `ANTHROPIC_API_KEY` is NOT needed.

- `OPENAI_API_KEY=...`   (required — embeddings `text-embedding-3-small` + parse/rerank `gpt-4o-mini`)
- Optional: `SEARCH_LLM_MODEL=...` to override the chat model (default `gpt-4o-mini`)
- Optional: `VOYAGE_API_KEY=...` + `EMBEDDING_PROVIDER=voyage` to swap the embedding model

## Step 4 — Backfill embeddings

```
npm run embed:alumni --workspace=apps/web
```

Scale: ~16,970 rows, batches of 50 @ 250ms delay ≈ **~7 minutes**, cost
≈ **<$0.10** on `text-embedding-3-small`. Idempotent; re-running only touches
rows with a null/stale embedding.

Pass condition:
```sql
SELECT COUNT(*) FROM alumni WHERE embedding IS NOT NULL AND is_public = true;
-- expect ≈ 16,970 (a few may skip if they have no embeddable text at all)
```

## Step 5 — Apply migration 024 (IVFFlat → HNSW)

**Supersedes the old IVFFlat REINDEX.** The 2026-06-01 audit found the IVFFlat
index from migration 023 (lists=100, default `ivfflat.probes=1`) scanned only
~1 cluster (~170 rows) per query: many valid queries returned ZERO candidates,
and a 30-phrase sweep reached only ~389 of 16,965 alumni.

In-place IVFFlat tuning was impossible here: `SET ivfflat.probes` /
`SET hnsw.ef_search` are denied to the Supabase role (ERROR 42501), and
production (PostgREST as `authenticated`) can't set session GUCs per request
anyway. Exact search gave perfect recall but ran 6–10s (statement-timeout
risk). HNSW is the answer: near-exact recall, sub-second, and good at its
DEFAULT ef_search (no parameter to set).

**Migration 024 must be run over a DIRECT connection, NOT the SQL Editor.** The
dashboard hit an HTTP-gateway timeout, and a parallel build hit ERROR 53100
(shared-memory exhaustion) on this small instance. Run `024_alumni_embedding_
hnsw.sql` via the **session pooler** connection string (Settings → Database →
Connect → Session pooler) with a `pg`/`psql` client. The migration sets
`max_parallel_maintenance_workers = 0` (avoids 53100), modest `maintenance_
work_mem`, and a long `statement_timeout`. Build took ~76s for ~17k rows.

Verify recall recovered:

```
npx tsx evals/alumniSearch/runEvals.ts
```

Pass condition: the "Recall health" section reports **0** match-expecting
queries with 0 recall (verdict PASS).

## Step 6 — Run the evals

```
npx tsx evals/alumniSearch/runEvals.ts
```

This headless runner exercises the REAL pipeline (parse → embed → RPC →
pre-score → rerank) against the live corpus, plus the privacy-exclusion test
(seeds + deletes its own `is_public=false` row) and a retrieval smoke test.
It prints matches + reasoning + per-stage latency for all 20 cases.

Last run (2026-05-29, pre-REINDEX): 19/20 acceptable. Real matches surface for
corporate-law, biotech, sports-marketing, tech, exclude-consultants,
narrow-to-Boston. Honest no-match (not false) for queries the corpus genuinely
can't satisfy (NYC fintech PMs, consulting→climate pivots, gap-year, founder
failure — the data has no "failure"/"gap-year" signal). Adversarial: all 5
pass (no fabricated alumni, no invented roles, no PII, privacy excluded,
prompt-injection neutralized).

## Step 7 — Measure latency

`runEvals.ts` already prints rerank + full-pipeline P50/P95.

Last run: rerank P50≈1.6s, pipeline **P50≈5.3s / P95≈8.7s** — **over the 3s
target.** Cause is two sequential `gpt-4o-mini` calls (parse ~3s + rerank
~2–5s); REINDEX trims the RPC tail but won't close the gap. This needs a
product call before flip — see the summary handed to the owner. Options:
accept ~5s behind the existing skeleton loader; skip the parse call for
filter-less queries; or stream the response.

## Step 8 — Flip the flag

In `packages/shared/featureFlags/alumniSearch.ts`, confirm
`ALUMNI_SEARCH_ROLLOUT_PERCENT = 10` (it already is). The flag is read by both
the web route and the mobile Discover header from this one constant. Deploy.

## Step 9 — Watch the data

Run `evals/alumniSearch/analytics.sql` Q1 daily for the first week.

Tripwire: if `no_matches + below_floor + no_candidates` > ~40% of searches,
stop widening. Likely causes: similarity threshold too high, embedding text
shape missing a field, or a retrieval gap surfaced by Q2 (top no-match
queries). Tune, re-backfill if the embedding text changed, then continue.
