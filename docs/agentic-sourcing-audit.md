# Campaign Home + Sourcing Quality — Build & Adversarial Audit

_Stacked on #6 (Phase 1 spine). Phase 0 engine = #4. This branch = the student-facing campaign home + the sourcing-quality hardening + an adversarial self-audit. **Merge-ready on the branch for review — not merged. Shipping to everyone is the founder's call.**_

## What this ships
- **Campaign home** (`/campaign`) — flag-gated student home: goal + progress, narrative, "ready to send", who-to-contact approval shelf, full-profile expand. **Human-send only — no auto-send.**
- **Sourcing quality** — deterministic **city-aware confidence gate**; **match-argument reasoner** (verifiable-fact-per-clause); **soft role-relevance downgrade**; **runtime integrity lint**.
- **Goal-taxonomy validation** + **live coverage probe** — an unservable slice ("Startups", thin fintech-in-LA) is caught **at goal-setting** with a one-tap broaden, not surfaced later as "Scout found nothing".
- **Honest copy** fix + a 96-case deterministic test suite.

## Adversarial audit

### What I checked
- 7-slice **live matrix** (Finance/Tech/Consulting/Healthcare/Law/Media + a junk "Startups" control), **8 adversarial judges**, ~16–18 real generated reasons read line by line.
- Prose integrity (manufactured athlete bond / non-literal title / filler) — **fixtures + a live lint over generated reasons**.
- Deterministic gate (**62 cases**), engine (**34 cases**).
- The **two FATAL invariants** (proposed-gate, cross-user ledger cap).
- **Dishonest-copy lint** across the agent/campaign surface.
- **Auth guard** on every route.

### What I found
- **FAIL (fixed): inconsistent city gate** — NYC exurbs (Rye, White Plains) reached HIGH while genuinely out-of-city candidates were correctly LOW; one reason even self-contradicted ("though located outside New York"). 
- **Dishonest copy (fixed):** the `/agent` result screen claimed *"All N messages queued / Follow-ups scheduled for Friday / Scout will notify you when someone replies"* — none true. (PR #5's honest-copy fix never reached this lineage.)
- **Residual warns (documented below, not silently "fixed"):** soft role-downgrade is probabilistic; junk role fields; metro radius is a judgment call.

### What I changed
- **Tightened the metro map** to city-proper + immediate commuter core (dropped Westchester/CT exurbs). → Greto (Rye) and Labbate (White Plains) now correctly **LOW** (verified in the matrix).
- **Runtime integrity lint** (`reasonLint`) replaces any manufactured-athlete / non-literal-title reason with a clean fact-based line — **deterministic, 0 live violations across 16 HIGH reasons**.
- **Fixed the 3 dishonest `/agent` claims** to prep-only honesty.

### The two FATAL re-audits
- **PROPOSED never reaches outreach without approval — PROVEN.** `assembleConnections` routes `proposed` to the approval shelf only (never to the engine); the engine gates `proposed → AWAIT` (eval: "proposed never in today/later"); the send path requires an `outreach_queue` row (only created for `interested`); approval is an explicit human action. **Live check: 5 proposed rows, 0 with any draft/send path.**
- **Cross-user ledger cap excludes across users — logic PROVEN.** Extracted to a pure `cappedAlumniIds` with **5 fixtures** (distinct-user counting, same-user-counts-once, excludes-only-the-overfished, threshold), wired into the cron's exclude set. _Not yet live-observed_ — the ledger is empty because no real sends have happened (Anthropic key absent). Will confirm live once sends occur.

### What's still imperfect (honest)
1. **Soft role-downgrade is LLM-probabilistic** (per the "soft, not hard" decision): a wrong-role-but-right-brand-and-city alum (e.g. a Google "Building Producer" for a SWE goal) can *occasionally* surface HIGH. The deterministic floor (real employer + industry + city) always holds, so it's never garbage — just an occasional non-ideal-role HIGH. A dedicated role-relevance pass would tighten it.
2. **Junk role fields** (scraped LinkedIn headlines like "People Whisperer who loves"; Cornell clubs tagged as employers): the lint refuses to fabricate a title and sidesteps to employer+industry+city, but the ranker can still award HIGH on those. Corpus data-quality limitation.
3. **Drafts were not live-audited** — `draftMessage` needs `ANTHROPIC_API_KEY` (absent). Reasons were audited live; the draft *prompt* guardrails (hedge unverified facts, channel-per-alum) are code-reviewed only. Add the key to audit drafts live before relying on them.
4. **Metro radius is a tunable policy** (see eyes-on #1).

## Two decisions for you (launch blockers — not guessed)
**1. Cross-user cap number + window (Decision 2, still unset).**
Code default today: **≤ 2 distinct students per alum / 90-day window**. Proposed conservative launch default: **keep 2 / 90 days**; consider **1 / 90 days** for the very first all-users ramp, then loosen with data. **LAUNCH BLOCKER: do NOT widen `AGENT_PILOT_USER_IDS` to all users (or raise the rollout to source for everyone) until you confirm this number.** Safe as-is — the loop is allowlist-gated to the pilot.

**2. Real send (Phase 5) does not exist.**
This PR ships **prep only**: Scout sources + drafts; the student reviews/edits and **sends manually** (copy / mailto / open LinkedIn); the human send is logged. **No copy claims "sent" or "we'll notify you when they reply" (lint-enforced). No LinkedIn automation.** Gmail send-as-self is a separate Phase 2 track (verification pending).

## What I'd want your eyes on before merge (judgment tests can't make)
1. **Metro radius policy** — I excluded NYC exurbs (Rye/White Plains/Stamford/Greenwich), kept boroughs + JC/Hoboken/Newark, and kept the **whole SF Bay** (Mountain View etc.) for tech. Is that NYC-tight / SF-wide asymmetry right for your market? (One line per metro in `sourceAlumniGate.ts`.)
2. **Soft role-downgrade vs precision** — accept occasional wrong-role-HIGH to preserve legit seniority (Principal-for-Analyst), or invest in a dedicated role-relevance pass?
3. **The cap number** (decision #1) — the actual launch blocker.
4. **Goal-set writes the profile slice** — setting a campaign goal overwrites `primary_industry` / `preferred_locations` / `interests` on the profile (campaign = current targeting). Fine, or should the slice live on its own `networking_plans` columns (migration 027)?
5. **Smith test-account data** was mutated on prod (dev DB = prod) to demo the live shelf — revert or leave?

## Merge-ready vs gated
**Merge-ready (to the branch, for your review):** campaign home, sourcing gate + reasoner + integrity lint, taxonomy validation + coverage probe, role downgrade, honest copy, **96 eval cases (62 gate + 34 engine) green, typecheck clean, all new routes auth-guarded**.
**Gated on your decisions:** enabling all-users sourcing (needs cap confirmation); real send (Phase 5, out of scope). The campaign-home flag is **OFF** in deployed prod and the cron allowlist is the pilot only — nothing reaches everyone until you flip those.

## Round 2 (2026-06-05, after first review)
- **Cap — DECIDED & implemented:** **10 distinct students per alum / 30-day window**, counted at the **add-to-outreach** contact event — `approve_target` now writes the ledger (the send proxy), not only `send`. One-line tunable (`ALUMNI_OUTREACH_MAX_STUDENTS` / `_WINDOW_DAYS`); never removed. **Still allowlist-gated — not to be widened past the pilot until the cap is observed working live, not just unit-tested.**
- **Prod-data cleanup — DONE:** Smith's demo mutations reverted (5 proposed rows + 1 demo plan deleted; profile restored to `primary_industry='Startups'`, `interests=null`). **Recommendation: stand up an off-prod staging DB (separate Supabase project or local Supabase seeded from a corpus snapshot) before any real-user testing — stop running test work against prod.**
- **Draft prompt — HARDENED:** the "lead with the shared sport" instruction (which invited a fabricated shared-sport bond in the outgoing message) is replaced with a sport-match-aware rule (fellow-Cornell-athlete is fine; a shared sport only when it genuinely matches), plus a non-literal-title sidestep and a no-canned-spam rule. A draft-audit harness is built and ready.
- **Drafts — STILL GATED (the blocker):** real drafts cannot be generated/audited until `ANTHROPIC_API_KEY` is in `.env.local` (only OpenAI is local). The moment it's there: generate across slices, adversarially audit (pad / manufactured bond / non-literal title / unverified fact / canned spam), fix + re-audit, then surface 8–10 real drafts for review. **Nothing ships until real drafts are read.**

## Eyes-on calls — my recommendations
1. **Metro radius:** keep the shipped asymmetry — NYC = boroughs + immediate NJ (no Westchester/CT); SF = full Bay incl. peninsula. NYC finance is hyper-local; SF tech is one integrated commuter metro. Per-metro tunable in `sourceAlumniGate.ts`. Rec: ship as-is, revisit with pilot feedback.
2. **Role-downgrade vs precision:** keep it SOFT for launch — the deterministic floor blocks garbage and an occasional wrong-role-but-real-company-and-city HIGH (e.g. a Google "Building Producer") is rare and low-harm. Add a dedicated role-relevance pass (~1 focused LLM call) only if pilot feedback shows it matters.
3. **Cap:** decided (above).
4. **Goal-set writes the profile slice:** keep for v1 — the campaign *is* the student's current targeting, the profile fields *are* the sourcing inputs, and it needs no migration. Move the slice onto its own `networking_plans` columns (migration 027) only when you want multi-campaign or an independent persistent profile.
5. **Smith data:** reverted (above), plus the staging-DB recommendation.

## Guardrails honored
Dev/staging only · nothing merged (PR open for review) · sends approval-gated + human-only · no LinkedIn automation · engine + alumni-search untouched · migration 026 additive, on the dev DB (= prod) only.
