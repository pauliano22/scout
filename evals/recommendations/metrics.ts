// Metrics for a single seeker's top-N recommendations.

import type { Seeker } from './seekers';

const FINANCE_MARKERS = [
  'finance', 'banking', 'investment', 'private equity', 'hedge fund',
  'asset management', 'venture capital', 'capital markets', 'wealth management',
];

export function isFinanceIndustry(industry: string | null | undefined): boolean {
  if (!industry) return false;
  const i = industry.toLowerCase();
  return FINANCE_MARKERS.some((m) => i.includes(m));
}

// Reasons that are NOT tied to the user's stated preferences — generic filler.
function isGenericReason(r: string): boolean {
  return (
    r.startsWith('Top-tier firm') ||
    r === 'Senior alum at a top-tier firm' ||
    r === 'Senior alum — strong perspective on hiring' ||
    r === 'Complete career profile worth reaching out to' ||
    r.includes('roles across their career') ||
    r.includes('years out — recent enough') ||
    r.includes('strong perspective on hiring')
  );
}

export interface ResultRow {
  name: string;
  industry: string | null;
  score: number;
  why: string[];
}

export interface SeekerMetrics {
  id: string;
  field: string;
  isFinance: boolean;
  picksWereEmpty: boolean;
  n: number;
  // Field relevance: share of results in the seeker's true field. null when the
  // field has no representation target (expectedIndustries empty).
  fieldRelevance: number | null;
  financeLeakage: number; // share of results that are finance
  sportsShare: number; // share whose industry is Sports
  distinctIndustries: number;
  topIndustry: string;
  topIndustryShare: number;
  avgReasons: number;
  pctGenericOnly: number; // share of cards whose reasons are all filler
  industryHistogram: Record<string, number>;
  top: ResultRow[];
}

export function evaluateSeeker(
  seeker: Seeker,
  results: Array<{ full_name?: string; industry: string | null; score: number; whyThisMatch: string[] }>,
): SeekerMetrics {
  const n = results.length;
  const expected = seeker.expectedIndustries.map((s) => s.toLowerCase());

  const hist: Record<string, number> = {};
  let financeCount = 0;
  let sportsCount = 0;
  let fieldCount = 0;
  let reasonTotal = 0;
  let genericOnly = 0;

  const top: ResultRow[] = results.map((r) => {
    const ind = r.industry ?? '(none)';
    hist[ind] = (hist[ind] ?? 0) + 1;
    if (isFinanceIndustry(r.industry)) financeCount++;
    if ((r.industry ?? '').toLowerCase() === 'sports') sportsCount++;
    if (expected.length && expected.includes((r.industry ?? '').toLowerCase())) fieldCount++;
    const reasons = r.whyThisMatch ?? [];
    reasonTotal += reasons.length;
    if (reasons.length > 0 && reasons.every(isGenericReason)) genericOnly++;
    return { name: r.full_name ?? '(unknown)', industry: r.industry, score: r.score, why: reasons };
  });

  const entries = Object.entries(hist).sort((a, b) => b[1] - a[1]);
  const [topIndustry, topCount] = entries[0] ?? ['(none)', 0];

  return {
    id: seeker.id,
    field: seeker.field,
    isFinance: seeker.isFinance,
    picksWereEmpty: seeker.prefs.industries.length === 0,
    n,
    fieldRelevance: expected.length ? (n ? fieldCount / n : 0) : null,
    financeLeakage: n ? financeCount / n : 0,
    sportsShare: n ? sportsCount / n : 0,
    distinctIndustries: entries.length,
    topIndustry,
    topIndustryShare: n ? topCount / n : 0,
    avgReasons: n ? reasonTotal / n : 0,
    pctGenericOnly: n ? genericOnly / n : 0,
    industryHistogram: hist,
    top,
  };
}

export interface Aggregate {
  label: string;
  seekerCount: number;
  nonFinanceCount: number;
  // Averages over NON-finance seekers (the population we're trying to fix):
  avgFieldRelevance_nf: number; // over non-finance seekers with a field target
  avgFinanceLeakage_nf: number;
  worstFinanceLeakage_nf: number;
  avgDistinctIndustries_nf: number;
  avgGenericOnly_nf: number;
  // Finance control:
  financeFieldRelevance: number;
  financeFinanceLeakage: number;
}

export function aggregate(label: string, all: SeekerMetrics[]): Aggregate {
  const nf = all.filter((m) => !m.isFinance);
  const nfWithField = nf.filter((m) => m.fieldRelevance !== null);
  const fin = all.find((m) => m.isFinance);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return {
    label,
    seekerCount: all.length,
    nonFinanceCount: nf.length,
    avgFieldRelevance_nf: avg(nfWithField.map((m) => m.fieldRelevance as number)),
    avgFinanceLeakage_nf: avg(nf.map((m) => m.financeLeakage)),
    worstFinanceLeakage_nf: Math.max(0, ...nf.map((m) => m.financeLeakage)),
    avgDistinctIndustries_nf: avg(nf.map((m) => m.distinctIndustries)),
    avgGenericOnly_nf: avg(nf.map((m) => m.pctGenericOnly)),
    financeFieldRelevance: fin?.fieldRelevance ?? 0,
    financeFinanceLeakage: fin?.financeLeakage ?? 0,
  };
}
