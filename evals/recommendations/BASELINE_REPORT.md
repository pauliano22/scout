# Baseline Eval Report

**Engine:** `selectRecommendations` / `scoreAlumnus` (mobile, current `main` logic)
**Dataset:** `apps/web/data/alumnidots.csv` (451 alumni — the production import)
**Prestige:** recomputed via faithful port of migration 016 (`prestige.ts`)
**Seekers:** 20 fields, fresh users (no swipe history). Top-10 per seeker.
**Reproduce:** `node evals/recommendations/run.cjs baseline`

## How to read this
- `field relevance` = share of a seeker's top-10 whose industry is genuinely in
  their field. Higher is better. `n/a` = field has no representation in the
  corpus (Hospitality, Agriculture), so we judge those by leakage instead.
- `finance leakage` = share of top-10 that are finance. For the 19 non-finance
  seekers this should be **low**; for the Finance control it is the relevance.
- `pref` = `pick` (user found a usable interest option) vs `skip` (no option fit,
  so they left industries empty — an allowed, common path).

## Headline numbers (non-finance seekers)
| Metric | Baseline |
|---|---|
| Avg field relevance | **53%** |
| Avg finance leakage | **28%** |
| Worst finance leakage | **70%** (Hospitality, Agriculture) |
| Avg distinct industries / top-10 | 3.42 |
| Finance control field relevance | 100% (must preserve) |
| Cards with only generic reasons | 0% (explanations are fine) |

## Per-seeker

```
field               pref   fld   fin  di  rsn   gen  industry mix (top10)
-------------------------------------------------------------------------
Medicine            pick  100%    0%   1  2.8    0%  Healthcare:10
Law                 pick   80%   10%   3  2.9    0%  Law:8 Finance:1 Education:1
Education           pick  100%    0%   1  2.7    0%  Education:10
Art / Design        pick   70%   10%   3  1.8    0%  Media:7 Sports:2 Finance:1
Nonprofit           pick   10%   60%   5  3.0    0%  Finance:6 Software:1 Nonprofit:1 Technology:1 Education:1
Skilled Trades      skip    0%   60%   4  2.2    0%  Finance:6 Sports:2 Law:1 Real Estate:1
Military            pick   20%   50%   4  2.8    0%  Finance:5 Government:2 Technology:2 Consulting:1
Sports              pick  100%    0%   1  3.0    0%  Sports:10
Entertainment       pick   40%   30%   5  2.9    0%  Media:4 Finance:3 Sports:1 Real Estate:1 Technology:1
Journalism          pick   50%   30%   4  2.4    0%  Media:5 Finance:3 Education:1 Healthcare:1
Engineering         pick  100%    0%   1  2.8    0%  Technology:10
Academia            pick  100%    0%   1  2.6    0%  Education:10
Hospitality         skip   n/a   70%   4  2.3    0%  Finance:7 Sports:1 Real Estate:1 Technology:1
Agriculture         skip   n/a   70%   3  2.0    0%  Finance:7 Sports:2 Technology:1
Social Work         pick   20%    0%   7  2.0    0%  Consulting:3 Nonprofit:2 Technology:1 Education:1 Sports:1 Manufacturing:1 Healthcare:1
Ministry            pick   20%   50%   4  2.0    0%  Finance:5 Nonprofit:2 Sports:2 Real Estate:1
Real Estate         pick   70%   10%   4  2.2    0%  Real Estate:7 Software:1 Finance:1 Technology:1
Manufacturing       skip    0%   50%   4  2.7    0%  Finance:5 Sports:2 Technology:2 Education:1
Government          pick   20%   40%   6  2.6    0%  Finance:4 Government:2 Healthcare:1 Education:1 Consulting:1 Technology:1
Finance (control)   pick  100%  100%   1  3.0    0%  Finance:10
```

## What this proves

**The system already works for fields that map cleanly AND have corpus depth:**
Medicine, Education, Sports, Engineering, Academia all hit 100%; Law 80%. So the
fix must *preserve* these, not rewrite scoring wholesale.

**Finance leaks into exactly the cases the audit predicted:**

1. **Empty-industry seekers** (Trades, Hospitality, Agriculture, Manufacturing):
   50–70% finance. With no `industries`, there is no Pass-1 pool and the prestige
   dampening never fires, so the deck is the prestige-ordered finance/sports pool.

2. **Thin-corpus or unmapped-field seekers** (Nonprofit 60%, Military 50%,
   Ministry 50%, Government 40%): a few real matches exist, but the deck fills
   from finance.

**The exact leak mechanism** (from `baseline/nonprofit.json`, top results):

```
#1 Software    score 64  [industry 0, sport 20, prestige 10, completeness 8]
#2 Nonprofit   score 58  [industry 30, sport 0, prestige 0,  completeness 6]  <- the real match
#4 Finance     score 44  [industry 0, sport 0,  prestige 10, completeness 8]
#5 Finance     score 44  [industry 0, sport 0,  prestige 10, completeness 8]
#6 Finance     score 44  [industry 0, sport 0,  prestige 10, completeness 8]
```

Even with the dampening cap, every finance alum carries a **+10 prestige floor**
that other non-matching fields (prestige 0) cannot match — so finance wins every
filler slot. Migration 016 hands finance that prestige for its *industry label
alone* (Tier 4 = 70, no company required), which then survives dampening at 10.

## Manufacturing is the clearest taxonomy bug
The corpus *has* Manufacturing alumni, but there is no Manufacturing interest
option, so the seeker can't reach them (0% relevance, 50% finance instead).

## Targets for Phase 3
- Drive non-finance avg field relevance up from 53%.
- Drive non-finance avg finance leakage down from 28% (esp. the 50–70% cases).
- Keep Finance control at 100% and the already-working fields at/near 100%.
