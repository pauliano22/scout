# Morning Review — Recommendation Multi-Field Overhaul

**Read this first.** Branch `recs/multi-field-overhaul`. **Nothing pushed.** 8 commits.

## TL;DR
Recs were finance-skewed because of **code, not data** (Technology is the biggest
field in the corpus, 112 rows; Finance is 37). I diagnosed it, built a
reproducible eval across 20 fields, and made 5 small, individually eval-gated
fixes. Result on the 19 non-finance seekers:

- **Field relevance 53% → 66%**
- **Finance leakage 28% → 13%** (worst case 70% → 50%)
- **Finance control held at 100%** — nothing I changed hurt finance.

Most well-represented fields (medicine, law, education, sports, engineering,
academia, entertainment, journalism, art) now return **90–100% on-field** results.

## The one decision I need from you
**Unify the two scoring engines, or keep them separate?**
My recommendation, with reasoning, is in `docs/recommendation-system-audit.md` §5:
**fix in place now (done), do NOT unify yet.** I did **not** unify anything. The
finance bias lived entirely in the mobile engine; the web "agent" runs on mock
data and the web Discover grid has no scorer. Unifying is worth doing later as
its own eval-backed project. *Want me to proceed with that, or leave it?*

## What I changed (all on the mobile engine, each its own commit)
1. `refactor` — extracted the scorer into a Supabase-free `recommendationScoring.ts`
   so the eval runs the **real** code (no behavior change).
2. `fix` — **field-neutral prestige**: stop giving finance/sports a free prestige
   head start for their industry label (migration 016's Tier 4 = 70pts for
   `industry='Finance'`, no company needed).
3. `fix` — off-field alumni now get **0 prestige** (was a 10pt floor that let
   finance win every filler slot).
4. `fix` — role matching **ignores bare seniority words** ("Director" was matching
   finance execs into a nonprofit seeker's deck). Mirrors the web scorer's
   existing blocklist.
5. `fix` — prestige **only counts on a field match**, so no-preference decks stop
   re-skewing to finance.
6. `fix(taxonomy)` — closed `Marketing → []` and the `Software`/`Technology` split.

Decision write-up: `docs/decisions/prestige-neutralization.md` (why I fixed this
in the scoring layer instead of a DB migration).

## What I deliberately did NOT do (need your call)

### 1. Add interest options for missing fields (UI-facing — your rule: /plan before UI)
The corpus *has* Manufacturing alumni, but there's no "Manufacturing" interest
chip, so users can't reach them — that seeker scores **0%** field relevance.
**The scoring already supports it**; only `INTEREST_SUGGESTIONS` (the onboarding
chip list) is missing the option. Proven: adding it takes that seeker **0% →
40%**. I left `INTEREST_SUGGESTIONS` untouched because it changes onboarding UI.
One-line change when you approve — suggest adding **Manufacturing** and
**Engineering**.

### 2. Touch migration 016 / the DB `prestige_score` column
I neutralized prestige in the **scoring layer** (reversible, no DB write — your
hard-stop list includes schema/data changes). The DB column is still
finance-tiered, which means the **web Discover grid** (`/api/alumni/search`,
which sorts by that column directly) is *still* finance-first. Fixing that needs
either a new migration or moving that grid onto the scorer — flagged, not done.

### 3. Pass-2 candidate-pool ordering at scale
`fetchRecommendations` fetches a prestige-ordered top-500 fallback pool. At <500
alumni (today) it doesn't bind, but past 500 it would cut non-finance alumni
before scoring. Needs a >500 dataset to test. Flagged.

## Hard stops — none hit
No paid APIs, no migrations, no auth/payments/PII, no cost changes, no >500-line
rewrites, and evals improved every iteration (never regressed). I stopped at 5
fixes because the remaining leakage is **data/UI-limited** (empty-corpus fields,
the missing Manufacturing chip, sport-driven filler in 2-row fields), and further
scoring tweaks would just overfit the eval.

## Where everything is
- **Diagnosis:** `docs/recommendation-system-audit.md`
- **Decision log:** `docs/decisions/prestige-neutralization.md`
- **Eval harness + how to run:** `evals/recommendations/README.md`
- **Baseline vs final:** `evals/recommendations/BASELINE_REPORT.md`,
  `evals/recommendations/FINAL_REPORT.md`
- **Every run (audit trail):** `evals/recommendations/{baseline,run-fix1..5,run-final}/`
- Re-run anytime: `node evals/recommendations/run.cjs run-$(date +%s)`
  (exits non-zero if finance or any working field regresses).

## Suggested next steps (in priority order)
1. Approve the **Manufacturing/Engineering** interest options (biggest remaining
   easy win; 1-line + a seeker update).
2. Decide **unify vs separate** engines (audit §5).
3. Align **migration 016 / web Discover grid** with field-neutral prestige.
4. Consider seeding alumni for empty fields, or accept adjacent-field mentoring
   for them.
