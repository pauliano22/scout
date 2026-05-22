// Faithful port of apps/web/supabase/migrations/016_alumni_prestige_score.sql.
//
// The import CSV has no prestige_score column, so the eval recomputes it exactly
// as the migration would, using the same tier arrays and SQL `ilike` semantics
// (% = any sequence, _ = any single char, case-insensitive). This lets the eval
// reproduce what the live `alumni.prestige_score` column holds.

function ilikeToRegExp(pattern: string): RegExp {
  // Escape regex metacharacters, then translate SQL ILIKE wildcards.
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const translated = escaped.replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${translated}$`, 'i');
}

function ilikeAny(value: string | null, patterns: string[]): boolean {
  if (!value) return false;
  return patterns.some((p) => ilikeToRegExp(p).test(value));
}

const TIER1_COMPANIES = [
  '%Goldman Sachs%', '%Morgan Stanley%', '%JPMorgan%', '%JP Morgan%',
  '%Blackstone%', '%BlackRock%', '%KKR%', '%Apollo%', '%Carlyle%',
  '%Citadel%', '%Two Sigma%', '%Bridgewater%', '%Point72%',
  '%D.E. Shaw%', '%Renaissance Technologies%', '%Elliott%',
  '%Warburg Pincus%', '%General Atlantic%', '%Sequoia%',
];

const TIER2_COMPANIES = [
  '%McKinsey%', '%Boston Consulting%', '% BCG%', 'BCG%',
  '%Bain %', '%Bain & Company%',
  '%Bank of America%', '%Merrill Lynch%',
  '%Lazard%', '%Evercore%', '%Moelis%', '%Guggenheim%',
  '%Citi%', '%Citigroup%', '%Barclays%', '%UBS%',
  '%Deutsche Bank%', '%Credit Suisse%', '%HSBC%',
];

const TIER3_COMPANIES = [
  '%Deloitte%', '%PwC%', '%PricewaterhouseCoopers%',
  '%Ernst & Young%', '% EY %', 'EY%', '%KPMG%',
  '%Accenture%', '%Oliver Wyman%', '%Booz Allen%',
  '%Google%', '%Apple%', '%Meta%', '%Microsoft%', '%Amazon%',
  '%Wells Fargo%', '%Fidelity%', '%Vanguard%', '%Charles Schwab%',
  '%Jefferies%', '%RBC%', '%Piper Sandler%', '%Stifel%',
  '%Raymond James%', '%Cowen%', '%William Blair%',
  '%TPG%', '%Advent International%', '%Vista Equity%',
  '%Ares Management%', '%Brookfield%',
];

const TIER4_INDUSTRIES = [
  '%Finance%', '%Banking%', '%Investment%',
  '%Private Equity%', '%Hedge Fund%', '%Asset Management%',
  '%Venture Capital%', '%Capital Markets%',
];

const TIER5_COMPANIES = [
  '%NFL%', '%NBA%', '%MLB%', '%NHL%', '%MLS%',
  '%ESPN%', '%Nike%', '%IMG%', '%CAA%', '%Endeavor%',
  '%WME%', '%Wasserman%', '%Octagon%',
];

export function computePrestigeScore(
  company: string | null,
  industry: string | null,
  role: string | null,
): number {
  let s = 0;
  if (ilikeAny(company, TIER1_COMPANIES)) s = 100;
  if (ilikeAny(company, TIER2_COMPANIES)) s = Math.max(s, 90);
  if (ilikeAny(company, TIER3_COMPANIES)) s = Math.max(s, 80);
  if (s < 70 && ilikeAny(industry, TIER4_INDUSTRIES)) s = Math.max(s, 70);
  if (ilikeAny(company, TIER5_COMPANIES) || ilikeAny(industry, ['%Sports%'])) s = Math.max(s, 65);
  if (s < 40 && company && role) s = Math.max(s, 40);
  if (s < 20 && company) s = Math.max(s, 20);
  return s;
}
