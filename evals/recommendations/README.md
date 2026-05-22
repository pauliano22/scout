# Recommendation Evals

Offline, reproducible evaluation of Scout's mobile recommendation engine across
diverse career fields. Built to answer: *do recommendations work for everyone, or
just finance?*

## Run

```bash
node evals/recommendations/run.cjs baseline          # (re)generate the baseline
node evals/recommendations/run.cjs run-$(date +%s)    # a labeled run, gated vs baseline
```

No build step — `run.cjs` loads the TypeScript engine at runtime via `jiti`
(already in the workspace) and resolves the `@scout/shared` alias.

## What it actually exercises

It calls the **real** engine: `selectRecommendations` / `scoreAlumnus` from
`apps/mobile/src/services/recommendationScoring.ts` (extracted from
`recommendations.ts` with no behavior change). Only the I/O boundary is
reproduced offline:

- `loadAlumni.ts` parses `apps/web/data/alumnidots.csv` (the production import).
- `prestige.ts` recomputes `prestige_score` as a faithful port of migration 016
  (the CSV has no prestige column; this is what the live DB column holds).
- `runEval.ts` rebuilds the two-pass candidate pool exactly as
  `fetchRecommendations` queries it, then calls the shared selection logic.

So a change to `recommendationScoring.ts` changes both the app and these evals —
the eval loop is meaningful.

## Files
- `seekers.ts` — 20 seeker fixtures. `prefs.industries` = what the user could
  realistically pick from the 13 interest options (or skip); `expectedIndustries`
  = the DB industry values truly relevant to their field. The gap between them is
  the taxonomy problem under test.
- `metrics.ts` — field relevance, finance leakage, diversity, explanation quality.
- `run.cjs` — entry point: runs, writes `<label>/REPORT.md` + `summary.json`, and
  for non-baseline labels prints a diff and **exits non-zero on regression**
  (finance control or any working field going backwards).

## Regression gate
A labeled run fails if, vs baseline:
- Finance control field relevance drops >5pt, or
- Non-finance avg field relevance drops >2pt, or
- Non-finance avg finance leakage rises >2pt.

## Caveats
- The corpus genuinely lacks some fields (no Art, Trades, Hospitality, Agriculture
  alumni). For those, field relevance is `n/a` and we judge by *not* dumping
  finance/sports — diversity + low leakage.
- Prestige is a port of migration 016. If that migration changes, re-derive here.
- Fresh users only (no swipe history) — isolates the cold-start ranking, which is
  where the bias is most visible.
