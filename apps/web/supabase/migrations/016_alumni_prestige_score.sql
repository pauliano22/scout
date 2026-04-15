-- Prestige score: surfaces well-known companies and finance-heavy alumni first in Discover.
-- Higher = shown earlier. Re-run anytime to refresh scores after new data imports.

alter table alumni
  add column if not exists prestige_score smallint not null default 0;

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

-- ── Tier 3: Big 4, top tech, tier-2 finance ─────────────────────────────── 80
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
    '%Ares Management%', '%Brookfield%'
  ]);

-- ── Tier 4: Finance industry (any company) ──────────────────────────────── 70
update alumni set prestige_score = greatest(prestige_score, 70) where
  prestige_score < 70
  and industry ilike any(array[
    '%Finance%', '%Banking%', '%Investment%',
    '%Private Equity%', '%Hedge Fund%', '%Asset Management%',
    '%Venture Capital%', '%Capital Markets%'
  ]);

-- ── Tier 5: Sports industry + well-known sports orgs ────────────────────── 65
update alumni set prestige_score = greatest(prestige_score, 65) where
  company ilike any(array[
    '%NFL%', '%NBA%', '%MLB%', '%NHL%', '%MLS%',
    '%ESPN%', '%Nike%', '%IMG%', '%CAA%', '%Endeavor%',
    '%WME%', '%Wasserman%', '%Octagon%'
  ])
  or industry ilike '%Sports%';

-- ── Tier 6: Has any company + role (complete profile) ───────────────────── 40
update alumni set prestige_score = greatest(prestige_score, 40) where
  prestige_score < 40
  and company is not null
  and role is not null;

-- ── Tier 7: Has company only ─────────────────────────────────────────────── 20
update alumni set prestige_score = greatest(prestige_score, 20) where
  prestige_score < 20
  and company is not null;

-- Index for fast ordering
create index if not exists alumni_prestige_score_idx on alumni (prestige_score desc);
