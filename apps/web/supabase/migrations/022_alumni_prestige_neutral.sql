-- Migration 022: field-neutral prestige_score
--
-- Replaces the finance-favoring Tier 4 (70 for `industry ILIKE '%Finance%'`
-- alone) and Tier 5 (65 for `industry ILIKE '%Sports%'`) introduced in
-- migration 016. Those handed every finance/sports alum a large head start
-- their industry label alone, with no other field able to earn the same
-- without a recognized company name. The eval (evals/recommendations/) showed
-- this collapsed every non-finance seeker's deck to finance.
--
-- This migration keeps the LEGITIMATE half of 016 — recognizable employer
-- (tiers 1–3) and profile depth (tiers 6–7) — and folds the recognizable
-- sports/media employers (NFL/ESPN/Nike/IMG/CAA/etc.) into Tier 3 so they
-- still surface, but only when there is an actual notable employer, not
-- because of an industry label.
--
-- The application scorer (packages/shared/scoring/recommendationScoring.ts)
-- already computes prestige this way client-side and ignores the DB column.
-- Running this migration aligns the column with the scorer so:
--   1. The mobile two-pass fetch ordering becomes field-neutral.
--   2. The web Discover grid can safely re-order by prestige_score again.
--   3. Any future surface that reads the column gets the right value.
--
-- Idempotent: re-run anytime to refresh scores after new data imports.

-- Reset all scores first
update alumni set prestige_score = 0;

-- ── Tier 1: Elite finance (bulge bracket, top PE/HF) ────────────────────── 100
update alumni set prestige_score = 100 where
  company ilike any(array[
    '%Goldman Sachs%', '%Morgan Stanley%', '%JPMorgan%', '%JP Morgan%',
    '%Blackstone%', '%BlackRock%', '%KKR%', '%Apollo%', '%Carlyle%',
    '%Citadel%', '%Two Sigma%', '%Bridgewater%', '%Point72%',
    '%D.E. Shaw%', '%Renaissance Technologies%', '%Elliott%',
    '%Warburg Pincus%', '%General Atlantic%', '%Sequoia%'
  ]);

-- ── Tier 2: Top consulting + top banks ──────────────────────────────────── 90
update alumni set prestige_score = greatest(prestige_score, 90) where
  company ilike any(array[
    '%McKinsey%', '%Boston Consulting%', '% BCG%', 'BCG%',
    '%Bain %', '%Bain & Company%',
    '%Bank of America%', '%Merrill Lynch%',
    '%Lazard%', '%Evercore%', '%Moelis%', '%Guggenheim%',
    '%Citi%', '%Citigroup%', '%Barclays%', '%UBS%',
    '%Deutsche Bank%', '%Credit Suisse%', '%HSBC%'
  ]);

-- ── Tier 3: Big 4, top tech, tier-2 finance, major sports/media orgs ───── 80
update alumni set prestige_score = greatest(prestige_score, 80) where
  company ilike any(array[
    '%Deloitte%', '%PwC%', '%PricewaterhouseCoopers%',
    '%Ernst & Young%', '% EY %', 'EY%', '%KPMG%',
    '%Accenture%', '%Oliver Wyman%', '%Booz Allen%',
    '%Google%', '%Apple%', '%Meta%', '%Microsoft%', '%Amazon%',
    '%Wells Fargo%', '%Fidelity%', '%Vanguard%', '%Charles Schwab%',
    '%Jefferies%', '%RBC%', '%Piper Sandler%', '%Stifel%',
    '%Raymond James%', '%Cowen%', '%William Blair%',
    '%TPG%', '%Advent International%', '%Vista Equity%',
    '%Ares Management%', '%Brookfield%',
    -- Major sports / media orgs — folded in from old Tier 5 because these are
    -- recognizable employers, not an industry-label bonus.
    '%NFL%', '%NBA%', '%MLB%', '%NHL%', '%MLS%',
    '%ESPN%', '%Nike%', '%IMG%', '%CAA%', '%Endeavor%',
    '%WME%', '%Wasserman%', '%Octagon%'
  ]);

-- (Migration 016's Tier 4 — 70 for `industry ILIKE '%Finance%'` alone — and
--  Tier 5 — 65 for `industry ILIKE '%Sports%'` alone — are intentionally
--  removed. See docs/decisions/prestige-neutralization.md.)

-- ── Tier 6: Has any company + role (complete profile) ───────────────────── 40
update alumni set prestige_score = greatest(prestige_score, 40) where
  prestige_score < 40
  and company is not null
  and role is not null;

-- ── Tier 7: Has company only ─────────────────────────────────────────────── 20
update alumni set prestige_score = greatest(prestige_score, 20) where
  prestige_score < 20
  and company is not null;

-- Index already exists from migration 016; no change needed.
