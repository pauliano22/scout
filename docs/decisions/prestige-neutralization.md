# Decision: Neutralize industry bias in prestige (scoring layer, not a migration)

**Status:** implemented (Phase 3, Fix #1)
**Context:** migration 016 makes `prestige_score` an industry signal — Tier 4
grants 70 to any `industry ILIKE '%Finance%'` and Tier 5 grants 65 to Sports,
neither requiring a company. Every other field can only earn prestige from a
company name, and 85% of alumni have none. The eval shows finance carries a +10
prestige floor (after dampening) that wins every filler slot for non-finance
seekers.

## The choice

**A. Fix the data:** new migration that recomputes `prestige_score`
industry-neutrally in the DB.

**B. Fix the scoring:** stop reading the biased `prestige_score` column in
`scoreAlumnus`; recompute a field-neutral "notability" from company recognition +
profile, ignoring industry label.

## Decision: B (scoring layer).

### Why
- **Avoids an overnight DB write.** Approach A writes to the production `alumni`
  table; the overnight brief lists schema/data changes as a hard-stop. B is pure
  app code — reversible with `git revert`, no DB access required.
- **Directly eval-testable.** The eval imports the same scoring module, so B is
  measured immediately; A would need DB plumbing the offline eval doesn't have.
- **Separation of concerns.** Ranking policy ("how much should a recognizable
  employer matter, regardless of field") belongs in the scorer, not frozen into a
  data column that three surfaces interpret differently.

### What "field-neutral prestige" means here
Keep the *legitimate* part of migration 016 — **recognizable employer** (the
company tiers: bulge-bracket, top consulting, big tech, major sports/media orgs)
and **profile depth** (has company+role) — and **drop the industry-label tiers**
(finance=70, sports=65). A finance analyst with no company now scores 0 prestige,
same as a teacher with no company. A Cornell alum at Google or ESPN still scores
high — because the *employer* is notable, which is useful to a seeker in that
field, not because of an industry label.

### Trade-offs / what we accept
- Recognizable-employer lists still skew toward firms that happen to be famous
  (finance/consulting/tech). That is acceptable: it rewards *notable employers*,
  which is a real contact-value signal, and it now benefits engineering/tech/
  sports/media seekers too — not just finance. The dampening still caps it when a
  seeker's stated field doesn't match.

### Follow-up (not done overnight — see MORNING_REVIEW)
- Eventually align migration 016 (or a successor) with this logic so the DB
  column and the scorer agree, and so Surface 3 (web Discover grid, which sorts
  by the column directly) stops being finance-first. Flagged for Ian.
