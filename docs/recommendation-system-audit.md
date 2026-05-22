# Recommendation System Audit

**Branch:** `recs/multi-field-overhaul`
**Date:** 2026-05-21
**Author:** Claude (overnight diagnostic pass)
**Goal of this work:** make recommendations work across *all* career fields, not just finance.

> TL;DR — The alumni data does **not** skew finance (Technology is the largest
> field, 112 rows; Finance is only 37). The finance bias is created by **code**,
> in two places: (1) the `prestige_score` design hands every finance/sports
> alum a large industry-based head start that no other field can earn, and (2)
> the interest taxonomy has dead-ends that drop most non-finance seekers into a
> prestige-ordered (finance-heavy) fallback pool. The swipe-adaptation loop is a
> real but secondary amplifier. Recommendation: **fix in place, do not unify the
> engines yet** (see §5).

---

## 1. Architecture Map

There are **three** recommendation/ranking surfaces. They do not share code.

| # | Surface | Persona | Entry point | Scorer | Data source |
|---|---------|---------|-------------|--------|-------------|
| 1 | **Mobile Discover deck** | Student-Athlete | `apps/mobile/src/hooks/useRecommendations.ts` → `fetchRecommendations()` → `scoreAlumnus()` | 8-dimension weighted (`recommendations.ts`) | Supabase `alumni` (live), per-user swipe adaptation |
| 2 | **Web "Scout Networking Agent"** | Alumni/demo | `apps/web/app/agent/AgentClient.tsx` → `runScoutNetworkingAgent()` → `rankAlumni()` | 5-factor (`lib/agent/score.ts`) | **`MOCK_ALUMNI`** (demo data) unless a pool is passed |
| 3 | **Web Discover grid** | Alumni/Admin | `apps/web/app/discover/DiscoverClient.tsx` → `GET /api/alumni/search` | **none** — SQL sort only | Supabase `alumni`, ordered `prestige_score DESC` |

**The primary, real, user-facing engine is Surface 1 (mobile).** It is the only
one that runs on live alumni data for the primary persona, adapts to behaviour,
and produces `whyThisMatch` explanations. Surface 2 runs on mock data (a demo).
Surface 3 has no scoring — it is full-text search + a prestige sort whose own
code comment reads *"prestige first (big companies, finance heavy)"*.

**This audit and the eval/fix work focus on Surface 1.** Surfaces 2 and 3 are
documented for completeness and flagged in §5.

### Data flow (Surface 1)
1. `useRecommendations` calls `fetchRecommendations(userId, prefs)`.
2. `fetchRecommendations`:
   - loads `alumni_swipes` + `user_networks` → `excludeIds`
   - **Pass 1**: `alumni` where `is_public` and `industry IN targetDbIndustries` (no limit)
   - **Pass 2**: `alumni` where `is_public`, `ORDER BY prestige_score DESC` LIMIT 500 (deduped vs pass 1)
   - `computeSwipeWeights(userId)` → per-category nudges
   - `scoreAlumnus()` every candidate → filter by completeness threshold → sort by score → top N
3. `scoreAlumnus` produces a `ScoreBreakdown` (8 dims) + `whyThisMatch` reasons.

---

## 2. Exact Weights, Queries, and Taxonomy

### 2.1 Mobile scorer — `BASE_WEIGHTS` (`recommendations.ts:55`)
| Dimension | Base | Cap (after swipe adj) | Gating |
|-----------|------|-----------------------|--------|
| industry | 30 | 40 | only if alum industry matches a stated interest (alias-expanded) AND `priorities.similarIndustry !== false` |
| role | 20 | 20 | substring match vs stated roles |
| sport | 20 | 30 | exact match vs stated sports |
| prestige | 25 | 25 | `prestige_score/100 * 25`; **capped at 10 if industries set & no industry match** (`:359`) |
| location | 15 | 20 | substring match vs stated locations |
| company | 10 | 15 | current(10)/past(6)/floor(4) if any role or company target set |
| completeness | 10 | 10 | `completenessScore/100 * 10` |
| graduationYear | 5 | 5 | 5 if 3–10 yrs out, else 2 |

- **Swipe adaptation** (`computeSwipeWeights`): per industry/sport/company/location, `+4` per save, `-2` per pass, clamped to `±12`. Applied as `adj` inside the caps above.
- **Quality gate:** `isHighQualityAlumniProfile(profile, 50)`; falls back to `30` when fewer than 5 high-quality candidates exist.
- **Completeness** (`alumniProfile.ts:180`): role 20, company 20, industry 10, location 10, bio 15, linkedin 10, photo 10, pastExperiences 20, education 5, sport|grad 5 (cap 125).

### 2.2 Web agent scorer — `W` (`lib/agent/score.ts:7`)
`industryFieldMatch 40`, `roleTextMatch 15`, `companyTextMatch 5`, `sportMatch 20`,
`locationMatch 15`, `hasRole 5`, `hasCompany 5`, `hasLinkedIn 5`, `seniority 10`.
- **Hard finance exclusion**: if the goal is not finance, every finance alum is forced to `score 0` and dropped (`:152`). This is an *over-correction* in the opposite direction (it makes finance invisible to everyone else instead of balancing fields).

### 2.3 Prestige scoring — migration `016_alumni_prestige_score.sql` (the core problem)
`prestige_score` (0–100) is assigned by tier. Reproduced exactly:

| Tier | Score | Condition |
|------|-------|-----------|
| 1 | 100 | company is elite finance (Goldman, Morgan Stanley, Blackstone, Citadel, …) |
| 2 | 90 | company is top consulting **or** top bank (McKinsey, Bain, BofA, Lazard, Citi, …) |
| 3 | 80 | company is Big 4 / top tech / tier-2 finance |
| **4** | **70** | **`industry ILIKE '%Finance%'` (or banking/investment/PE/HF/AM/VC/capital markets) — _no company required_** |
| **5** | **65** | **`industry ILIKE '%Sports%'` or known sports org — _no company required_** |
| 6 | 40 | has company **and** role |
| 7 | 20 | has company only |

**The asymmetry:** Finance and Sports can earn a high prestige score purely from
their *industry label* (Tiers 4–5). Every other field can only earn prestige via
a **company name** (Tiers 1–3, 6, 7). See §3 for why that is decisive.

### 2.4 Taxonomy — `packages/shared/constants/interests.ts`
- `INTEREST_SUGGESTIONS` (what users can pick): 13 options. **Two of them**
  (`Finance` and `Private Equity / Venture Capital`) both resolve to DB `Finance`.
- `INTEREST_DB_INDUSTRIES` (drives Pass-1 `.in()` query):
  - `Marketing → []` — **empty**, so a marketing seeker gets *zero* Pass-1 matches.
  - Every value maps to a single exact DB string. Variants are missed
    (the data contains a `Software` industry value distinct from `Technology`).
  - No entry exists for: medicine (only `Healthcare`), art/design, trades,
    military, journalism, academia, hospitality, agriculture, social work,
    ministry, manufacturing, government-by-that-name, etc.

---

## 3. Top Hypotheses for Finance Bias (ranked)

Data evidence below comes from running the real prestige logic (migration 016)
over the actual import dataset `apps/web/data/alumnidots.csv` (452 rows). The
reproduction script lives at `evals/recommendations/prestige.ts`.

### ❌ Rejected first: "the dataset skews finance"
**False.** Industry counts in the 452-row dataset:

```
Technology 112 | (blank) 99 | Healthcare 44 | Consulting 42 | Education 38
Finance 37 | Sports 31 | Media 20 | Law 10 | Real Estate 7 | Manufacturing 4
Government 5 | Nonprofit 2 | Software 1
```

Technology is **3×** the size of Finance. The bias is not in the data — it is in
the scoring. Also notable: **85% of rows (383/452) have no `company`**, which is
what makes the prestige asymmetry (§2.3) bite so hard.

---

### 🥇 Hypothesis 1 — `prestige_score` is an industry-biased baseline (PRIMARY)
**Claim:** Migration 016 gives finance/sports a large prestige head start that no
other field can earn, and `prestige_score` then (a) contributes up to 25 points
directly in `scoreAlumnus`, and (b) orders the Pass-2 fallback pool that fills
most decks.

**Evidence — code:** Tiers 4–5 award 70/65 from the *industry label alone*; all
other fields require a company name (Tiers 1–3, 6, 7). `BASE_WEIGHTS.prestige = 25`.
`fetchRecommendations` Pass 2 is `ORDER BY prestige_score DESC LIMIT 500`.

**Evidence — data (simulated prestige by industry):**

```
industry        n   mean  #>=70  #=0
Finance        37   70.5     37    0     ← every finance alum ≥ 70
Sports         31   65.0      0    0     ← every sports alum = 65
Healthcare     44    7.3      0   36
Education      38    5.3      0   33
Technology    112    5.0      1   99     ← 99 of 112 get ZERO
Consulting     42    3.8      0   38     ← consultants rarely list a firm name
Law            10    4.0      0    9
Media          20    2.0      0   19
```

**The kicker:** the **top 50 alumni by prestige_score = 37 Finance + 12 Sports +
1 Technology.** Any seeker whose Pass-1 industry pool is empty or small sees a
deck drawn from this pool — i.e., essentially all finance and sports.

A finance alum starts every comparison ~`round(70/100 * 25) = 18` points ahead,
before a single preference is considered. There is a partial mitigation already
in code (prestige is capped at 10 when industries are set but unmatched,
`recommendations.ts:359`) — but it does not apply when industries are empty, it
does not fix the Pass-2 pool ordering, and it caps rather than neutralizes.

---

### 🥈 Hypothesis 2 — taxonomy dead-ends route non-finance seekers to the finance pool
**Claim:** Most non-finance seekers can't form a Pass-1 match, so their whole deck
comes from the finance-ordered Pass-2 fallback — and when industries are empty
there's no prestige dampening either.

**Evidence — code:**
- `INTEREST_DB_INDUSTRIES['Marketing'] = []` → marketing seeker: 0 Pass-1 rows.
- No taxonomy entry for medicine-as-such, art/design, trades, military,
  journalism, academia, hospitality, agriculture, social work, ministry,
  manufacturing → those seekers cannot express intent → `prefs.industries = []`
  → no Pass-1, **and** the §2.3 prestige dampening (`industries.length > 0`) never
  fires → pure prestige deck → finance/sports.
- Two of the 13 user-facing options funnel into DB `Finance`.
- Single-exact-string mapping misses stored variants (`Software` ≠ `Technology`).

**Evidence — data:** With Pass-1 empty, the deck = Pass-2 = top of the
prestige order = the 37-Finance/12-Sports/1-Tech pool shown above. Fields that
*are* mapped (Healthcare, Law, Education, Consulting, Technology, Government via
alias, Nonprofit, Media, Sports, Real Estate) fare much better because industry
(30) + prestige dampening kick in — confirming the bias is concentrated in the
unmapped/dead-end fields and the empty-preferences case.

---

### 🥉 Hypothesis 3 — industry weight + swipe loop is a secondary amplifier
**Claim:** The 30/40 industry weight is *not* inherently pro-finance (it rewards
whatever the user picked). But the swipe-adaptation loop can entrench finance
once H1/H2 have seeded a finance-heavy initial deck.

**Evidence — code:** `computeSwipeWeights` adds `+4` per save to the saved alum's
industry (cap `±12`), raising the industry cap from 30 toward 40 for that field.
If the *initial* deck is finance-heavy (H1/H2), early saves skew finance, which
nudges the industry weight toward finance, which surfaces more finance. The
company dimension also has a `4`-point floor for any alum with a current company
(`recommendations.ts:325`), a minor non-preference bump.

**Why it's ranked last:** it is strictly *downstream* of H1/H2 — it cannot start a
finance bias, only reinforce one that the prestige/taxonomy design already
created. Fixing H1/H2 largely defuses it.

---

## 4. What a fix needs to achieve
1. **Neutralize the industry component of prestige** — reward profile quality,
   seniority, and recognizable employers *regardless of field*; stop granting
   70/65 for being finance/sports.
2. **Close the taxonomy dead-ends** — fix `Marketing`, broaden DB mappings to
   cover variants, and add the missing fields so seekers can express intent.
3. **De-bias the fallback pool** — when filling a deck beyond Pass-1 matches,
   don't order purely by the (finance-heavy) prestige column.
4. Prove each change with the eval harness; revert anything that regresses a
   working field (including finance as a control).

---

## 5. Decision flagged for Ian: Unify the engines, or fix in place?

**My recommendation: FIX IN PLACE NOW. Do not unify the three surfaces yet.**
I have **not** unified anything and will not without your sign-off.

**Why fix-in-place:**
- The finance bias lives entirely in Surface 1's prestige design + taxonomy —
  both fixable without touching the other surfaces.
- The engines have genuinely different shapes and jobs: Surface 1 consumes rich
  `Alumni` rows + swipe history + completeness + prestige and emits
  `whyThisMatch`; Surface 2 consumes lightweight `AgentAlumni` + a free-text goal
  and **runs on mock data**; Surface 3 isn't a scorer at all.
- Unifying now would mean reconciling those type shapes and feature sets on top
  of a scorer we haven't yet made correct or measurable. That's a large, risky
  change layered on an unproven base.

**Why unify later (worth doing, as its own project):**
- Two scorers will drift; `whyThisMatch` vs `reason` already diverge; the web
  agent's hard finance *exclusion* is the opposite over-correction.
- Once Surface 1's scoring is correct and eval-gated (this work), a unified,
  shared, eval-backed ranker in `packages/shared` is the right end state.

**Proposed sequencing:** (1) this overnight work fixes + evals Surface 1; (2) a
later, separately-scoped project promotes the corrected scorer into
`packages/shared` and retires the web agent's mock/exclusion logic. I'll wait for
your decision before starting (2).
