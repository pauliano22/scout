# Final Eval Report

**Reproduce:** `node evals/recommendations/run.cjs run-final`
**Compare:** baseline = current `main` logic; final = after 5 scoring/taxonomy fixes.
All runs are committed under `evals/recommendations/run-fix*/` and `run-final/`.

## Headline (19 non-finance seekers)

| Metric | Baseline | Final | Δ |
|---|---|---|---|
| **Avg field relevance** | 53% | **66%** | **+13pt** |
| **Avg finance leakage** | 28% | **13%** | **−16pt** |
| Worst finance leakage | 70% | **50%** | −20pt |
| Avg distinct industries | 3.42 | 3.00 | −0.42 (see note) |
| Cards with only generic reasons | 0% | 0% | — |
| **Finance control field relevance** | 100% | **100%** | **0 (preserved)** |

> Note on diversity: the small drop is **good**. Mapped fields now return purer
> single-field decks (Law went `Law:8 Finance:1 Education:1` → `Law:10`). That is
> precision improving, not diversity collapsing. Diversity only matters for
> no-corpus / no-preference seekers, where it stayed flat or rose.

## Per-seeker (final)

```
field               pref   fld   fin  di  rsn   gen  industry mix (top10)
-------------------------------------------------------------------------
Medicine            pick  100%    0%   1  2.8    0%  Healthcare:10
Law                 pick  100%    0%   1  2.6    0%  Law:10
Education           pick  100%    0%   1  2.7    0%  Education:10
Art / Design        pick  100%    0%   1  2.0    0%  Media:10
Nonprofit           pick   20%    0%   5  2.1    0%  Technology:5 Nonprofit:2 Software:1 Consulting:1 Education:1
Skilled Trades      skip    0%   20%   6  1.9    0%  Technology:3 Finance:2 Sports:2 Law:1 Real Estate:1 Education:1
Military            pick   50%   20%   4  2.3    0%  Government:5 Finance:2 Technology:2 Consulting:1
Sports              pick  100%    0%   1  3.0    0%  Sports:10
Entertainment       pick  100%    0%   1  2.2    0%  Media:10
Journalism          pick   90%    0%   2  2.1    0%  Media:9 Education:1
Engineering         pick  100%    0%   1  2.8    0%  Technology:10
Academia            pick  100%    0%   1  2.6    0%  Education:10
Hospitality         skip   n/a   30%   7  2.4    0%  Finance:3 Real Estate:2 Sports:1 Technology:1 (none):1 Consulting:1 Healthcare:1
Agriculture         skip   n/a   50%   2  2.1    0%  Technology:5 Finance:5
Social Work         pick   20%    0%   7  2.0    0%  Consulting:3 Nonprofit:2 Technology:1 Education:1 Manufacturing:1 Sports:1 Healthcare:1
Ministry            pick   20%   50%   4  2.0    0%  Finance:5 Nonprofit:2 Sports:2 Real Estate:1
Real Estate         pick   70%    0%   3  2.2    0%  Real Estate:7 Technology:2 Software:1
Manufacturing       skip    0%   50%   4  2.8    0%  Finance:5 Technology:3 Education:1 Healthcare:1
Government          pick   50%   20%   5  2.4    0%  Government:5 Finance:2 Healthcare:1 Education:1 Consulting:1
Finance (control)   pick  100%  100%   1  3.0    0%  Finance:10
```

## What the fixes were (each its own commit, each eval-gated)

1. **Field-neutral prestige** (`fbe67c7`) — stop reading `prestige_score` (migration
   016 inflates it 70/65 for the finance/sports *label*); compute prestige from
   recognizable employer + profile depth. → leakage 28%→23%.
2. **Zero prestige for off-field alumni** (`f442c93`) — was a 10pt floor that let
   finance win every filler slot. → field relevance 55%→65%, leakage 23%→17%.
3. **Ignore bare seniority words in role match** (`5679ce9`) — "Director"/"Manager"
   etc. matched across all fields (finance "Managing Director" filling a nonprofit
   deck). → Nonprofit finance 60%→0%; overall leakage 17%→14%.
4. **Prestige only counts on a field match** (`2a90f44`) — no-preference decks were
   re-skewing to finance via recognizable-employer prestige. → leakage 14%→13%,
   worst 60%→50%.
5. **Close taxonomy dead-ends** (`898eb02`) — `Marketing → []` and the
   `Software`/`Technology` split. Correctness; corpus-limited eval impact.

## Field-by-field outcome

**Now excellent (≥90% on-field):** Medicine, Law, Education, Art/Design, Sports,
Entertainment, Journalism, Engineering, Academia — and Finance control (100%).
Most reach 100%. These either improved (Law 80→100, Art 70→100, Entertainment
40→100, Journalism 50→90) or held.

**Improved but corpus/sport-limited:** Military 20→50, Government 20→50,
Real Estate 70 (held), Nonprofit (finance leak 60→0; field relevance still 20%
because the corpus has only **2** nonprofit alumni). For these the *real* matches
now rank first; the rest is unavoidable filler.

**Still leaking — and why (not a scoring bug):**
- **Manufacturing 0% field / 50% finance** — the corpus *has* 4 manufacturing
  alumni, but there is no "Manufacturing" interest option, so the user can't
  select it. Proven fix: with the option, this seeker jumps to **40% field
  relevance** (`/tmp` probe; scoring already supports it via fallback). → flagged
  for Ian (UI change).
- **Trades / Hospitality / Agriculture** — the corpus has **no alumni** in these
  fields. Field relevance is `n/a`; we can only avoid dumping finance, which we
  do (leakage down to 20–50%, from 60–70%). This is a **data** limit, not code.
- **Ministry 50% / sport-driven filler** — only 2 nonprofit alumni exist; the
  remaining slots fill with same-sport (lacrosse → finance-heavy) alumni. Real
  matches still rank #1–2. A residual: tied filler is still ordered by the
  prestige-sorted Pass-2 pool (finance first). See follow-ups.

## Honest limitations of this eval
- Cold-start only (no swipe history). The adaptive loop is a separate concern;
  with the cold-start bias removed it has far less finance to reinforce.
- Prestige is a faithful port of migration 016; if that migration changes,
  re-derive `prestige.ts`.
- Six of the 20 fields have little/no representation in the 451-row corpus, so
  their ceiling is bounded by data, not scoring.

## Recommended follow-ups (not done overnight)
1. Add **Manufacturing** and **Engineering** to `INTEREST_SUGGESTIONS` (UI). Eval
   shows the scoring already supports them. (See MORNING_REVIEW.)
2. Neutralize **Pass-2 ordering / filler tie-breaks** so the finance-sorted pool
   stops deciding ties; matters most at >500 alumni where the 500-cap binds.
3. Align **migration 016** (or a successor) with the field-neutral prestige, so
   the DB column and Surface 3 (web Discover grid, which sorts by it directly)
   stop being finance-first.
4. Seed/import alumni for the empty fields (trades, hospitality, agriculture, …)
   or set expectations that those fields show adjacent-field mentors.
