import { supabase } from '../lib/supabase';
import {
  isHighQualityAlumniProfile,
  normalizeAlumniProfile,
  type NormalizedAlumni,
} from '../lib/alumniProfile';
import type { Alumni } from '../types/database';

export interface UserPreferences {
  industries: string[];
  sports: string[];
  locations: string[];
  roles: string[];
  companies?: string[];
  graduationYearMin?: number;
  graduationYearMax?: number;
  priorities: {
    sameSport: boolean;
    similarIndustry: boolean;
    seniorAlumni: boolean;
  };
}

export interface SwipeWeights {
  industry: Record<string, number>;
  sport: Record<string, number>;
  company: Record<string, number>;
  location: Record<string, number>;
}

export interface ScoreBreakdown {
  industry: number;
  role: number;
  sport: number;
  location: number;
  company: number;
  graduationYear: number;
  completeness: number;
  prestige: number;
  total: number;
}

/**
 * Public deck item — the raw Alumni row plus the normalized profile, scoring
 * info, and human-readable match reasons.
 */
export interface ScoredAlumni extends Alumni {
  profile: NormalizedAlumni;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  whyThisMatch: string[];
}

const BASE_WEIGHTS = {
  industry: 30,
  role: 20,
  sport: 20,
  location: 15,
  company: 10,
  graduationYear: 5,
  completeness: 10,
  // Prestige is high enough to dominate ties when no preference matches,
  // but below a real industry+sport match (50pt) so explicit prefs still win.
  prestige: 25,
};

const QUALITY_THRESHOLD = 50;
const QUALITY_FALLBACK_THRESHOLD = 30;

function ciIncludes(haystack: string | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function ciEquals(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function computeWhyThisMatch(
  profile: NormalizedAlumni,
  prefs: UserPreferences,
  breakdown: ScoreBreakdown,
): string[] {
  const reasons: string[] = [];
  const history = profile.pastExperiences;

  // Past-company overlap with the user's target companies. Strong signal
  // because it means this alum has already done the thing the student wants.
  const targetCompanies = prefs.companies ?? [];
  if (targetCompanies.length > 0 && history.length > 0) {
    const tenure = computeTenureByCompany(history);
    for (const target of targetCompanies) {
      const yrs = tenure.get(target.toLowerCase());
      if (yrs && yrs >= 1) {
        reasons.push(
          yrs >= 2
            ? `${yrs}+ years at ${target}`
            : `Worked at ${target}`,
        );
        break; // one is enough — keep the card scannable
      }
    }
  }

  // Career pivot: was in a target industry earlier, now elsewhere
  // (or vice versa). Useful for students considering a similar move.
  const pivot = detectIndustryPivot(profile, prefs);
  if (pivot && reasons.length < 3) {
    reasons.push(pivot);
  }

  if (breakdown.industry > 0 && profile.industry && !reasons.length) {
    reasons.push(`Works in ${profile.industry}`);
  } else if (breakdown.industry > 0 && profile.industry) {
    reasons.push(`Now in ${profile.industry}`);
  }

  if (breakdown.sport > 0 && profile.sport && prefs.sports.length > 0) {
    reasons.push(`Same sport — ${profile.sport}`);
  }
  if (breakdown.location > 0 && profile.location && reasons.length < 3) {
    reasons.push(`Based in ${profile.location}`);
  }
  if (breakdown.role > 0 && profile.currentRole && reasons.length < 3) {
    reasons.push(`Currently a ${profile.currentRole}`);
  }
  if (breakdown.company > 0 && profile.currentCompany && reasons.length < 3) {
    reasons.push(`At ${profile.currentCompany}`);
  }

  // Career depth signal — only when work history actually backs it up
  if (history.length >= 4 && reasons.length < 3) {
    reasons.push(`${history.length}+ roles across their career`);
  }

  // Prestige callout — only when no current company is shown (otherwise
  // implicit) AND the firm is recognizably top-tier
  if (
    breakdown.prestige >= 22 &&
    !reasons.some((r) => r.startsWith('At ') || r.startsWith('Worked at ')) &&
    reasons.length < 3
  ) {
    reasons.push(profile.currentCompany ? `Top-tier firm — ${profile.currentCompany}` : 'Senior alum at a top-tier firm');
  }

  if (profile.graduationYear && reasons.length < 3) {
    const yearsOut = new Date().getFullYear() - profile.graduationYear;
    if (yearsOut >= 3 && yearsOut <= 8) {
      reasons.push(`${yearsOut} years out — recent enough for practical advice`);
    } else if (yearsOut >= 12) {
      reasons.push(`Senior alum — strong perspective on hiring`);
    }
  }

  if (reasons.length === 0 && profile.profileCompletenessScore >= 70) {
    reasons.push('Complete career profile worth reaching out to');
  }

  return reasons.slice(0, 4);
}

/**
 * Returns approximate years spent at each company based on work_history dates.
 * Returns lowercase keys for case-insensitive lookup. Falls back to 1 year
 * per role when dates are missing so we can still surface "Worked at X"
 * without overstating tenure.
 */
function computeTenureByCompany(
  history: NormalizedAlumni['pastExperiences'],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of history) {
    if (!e?.company) continue;
    const key = e.company.trim().toLowerCase();
    let years = 0;
    const startYear = e.start?.year ?? null;
    const endYear = e.end?.year ?? new Date().getFullYear();
    if (startYear) {
      years = Math.max(0, endYear - startYear);
    }
    if (years === 0) years = 1; // unknown duration, assume ≥1y
    map.set(key, (map.get(key) ?? 0) + years);
  }
  return map;
}

/**
 * Detects when an alumnus moved INTO or OUT OF a user's target industry.
 * Returns null when there's no clear pivot or no target industry signal.
 */
function detectIndustryPivot(
  profile: NormalizedAlumni,
  prefs: UserPreferences,
): string | null {
  if (prefs.industries.length === 0) return null;
  if (profile.pastExperiences.length < 2) return null;

  const earliest = profile.pastExperiences[profile.pastExperiences.length - 1];
  if (!earliest?.company) return null;

  // We only know per-entry company/title, not industry. Heuristic: if the
  // earliest company is well-known in a recognizable bucket and the current
  // industry is a target, call it out as a pivot.
  const earlyBucket = guessIndustryBucket(earliest.company);
  const currentMatchesTarget = prefs.industries.some(
    (ind) => ciEquals(ind, profile.industry),
  );

  if (earlyBucket && currentMatchesTarget && earlyBucket !== profile.industry) {
    return `Started in ${earlyBucket}, now in ${profile.industry}`;
  }
  return null;
}

// Tiny keyword classifier for the few buckets we use most.
// Intentionally narrow — false positives here read worse than missing reasons.
function guessIndustryBucket(company: string): string | null {
  const c = company.toLowerCase();
  if (/(goldman|morgan stanley|jpmorgan|jp morgan|citi|blackrock|barclays|ubs|deutsche)/.test(c)) {
    return 'Finance';
  }
  if (/(mckinsey|bain|bcg|deloitte|accenture|kpmg|ey|pwc)/.test(c)) {
    return 'Consulting';
  }
  if (/(google|meta|facebook|amazon|apple|microsoft|nvidia|airbnb|stripe|uber|netflix)/.test(c)) {
    return 'Technology';
  }
  return null;
}

function scoreAlumnus(
  alumni: Alumni,
  prefs: UserPreferences,
  swipeWeights: Partial<SwipeWeights>,
): ScoredAlumni {
  const profile = normalizeAlumniProfile(alumni);
  const breakdown: ScoreBreakdown = {
    industry: 0,
    role: 0,
    sport: 0,
    location: 0,
    company: 0,
    graduationYear: 0,
    completeness: 0,
    prestige: 0,
    total: 0,
  };

  // Industry match
  if (profile.industry && prefs.industries.length > 0) {
    const match = prefs.industries.some((ind) => ciEquals(ind, profile.industry));
    if (match) {
      const adj = swipeWeights.industry?.[profile.industry] ?? 0;
      breakdown.industry = Math.max(0, Math.min(BASE_WEIGHTS.industry + adj, 40));
    }
  }

  // Role match
  if (profile.currentRole && prefs.roles.length > 0) {
    const matchesRole = prefs.roles.some(
      (r) => ciIncludes(profile.currentRole, r) || ciIncludes(r, profile.currentRole ?? ''),
    );
    if (matchesRole) breakdown.role = BASE_WEIGHTS.role;
  }

  // Sport match
  if (profile.sport && prefs.sports.length > 0) {
    const match = prefs.sports.some((s) => ciEquals(s, profile.sport));
    if (match) {
      const adj = swipeWeights.sport?.[profile.sport] ?? 0;
      breakdown.sport = Math.max(0, Math.min(BASE_WEIGHTS.sport + adj, 30));
    }
  }

  // Location match
  if (profile.location && prefs.locations.length > 0) {
    const match = prefs.locations.some(
      (loc) => ciIncludes(profile.location, loc) || ciIncludes(loc, profile.location ?? ''),
    );
    if (match) {
      const adj = swipeWeights.location?.[profile.location] ?? 0;
      breakdown.location = Math.max(0, Math.min(BASE_WEIGHTS.location + adj, 20));
    }
  }

  // Company match — current company OR any past company in target list.
  // Past-company match is slightly less weighted than current.
  if (profile.currentCompany && (prefs.roles.length > 0 || (prefs.companies?.length ?? 0) > 0)) {
    const adj = swipeWeights.company?.[profile.currentCompany] ?? 0;
    const targets = prefs.companies ?? [];
    const currentMatch = targets.some((c) => ciEquals(c, profile.currentCompany));
    const pastMatch =
      !currentMatch &&
      targets.length > 0 &&
      profile.pastExperiences.some((e) =>
        targets.some((c) => ciEquals(c, e.company ?? null)),
      );

    const baseWeight = currentMatch
      ? BASE_WEIGHTS.company
      : pastMatch
        ? Math.round(BASE_WEIGHTS.company * 0.6)
        : 4;
    breakdown.company = Math.max(0, Math.min(baseWeight + adj, 15));
  }

  // Graduation year — prefer recent enough alumni
  if (profile.graduationYear) {
    const currentYear = new Date().getFullYear();
    const yearsOut = currentYear - profile.graduationYear;
    const minYear = prefs.graduationYearMin ?? currentYear - 25;
    const maxYear = prefs.graduationYearMax ?? currentYear - 1;

    if (profile.graduationYear >= minYear && profile.graduationYear <= maxYear) {
      if (yearsOut >= 3 && yearsOut <= 10) {
        breakdown.graduationYear = BASE_WEIGHTS.graduationYear;
      } else if (yearsOut > 0) {
        breakdown.graduationYear = Math.floor(BASE_WEIGHTS.graduationYear / 2);
      }
    }
  }

  // Completeness — high quality profiles bubble up
  const normalized = profile.profileCompletenessScore / 100;
  breakdown.completeness = Math.round(normalized * BASE_WEIGHTS.completeness);

  // Prestige — prestige_score is 0-100 (set by migration 016, scaled by tier).
  // Linear contribution. Top firms (≥90) get nearly the full weight.
  const prestigeRaw =
    typeof alumni.prestige_score === 'number' ? alumni.prestige_score : 0;
  const prestigeNormalized = Math.max(0, Math.min(prestigeRaw, 100)) / 100;
  breakdown.prestige = Math.round(prestigeNormalized * BASE_WEIGHTS.prestige);

  breakdown.total =
    breakdown.industry +
    breakdown.role +
    breakdown.sport +
    breakdown.location +
    breakdown.company +
    breakdown.graduationYear +
    breakdown.completeness +
    breakdown.prestige;

  const whyThisMatch = computeWhyThisMatch(profile, prefs, breakdown);

  return {
    ...alumni,
    profile,
    score: breakdown.total,
    scoreBreakdown: breakdown,
    whyThisMatch,
  };
}

async function computeSwipeWeights(userId: string): Promise<Partial<SwipeWeights>> {
  try {
    const { data: swipes } = await supabase
      .from('alumni_swipes')
      .select('action, alumni_id')
      .eq('user_id', userId)
      .limit(200);

    if (!swipes || swipes.length === 0) return {};

    const alumniIds = swipes.map((s) => s.alumni_id);
    const { data: swipedAlumni } = await supabase
      .from('alumni')
      .select('id, industry, sport, company, location')
      .in('id', alumniIds);

    if (!swipedAlumni) return {};

    const alumniMap = new Map(swipedAlumni.map((a) => [a.id, a]));

    const weights: SwipeWeights = {
      industry: {},
      sport: {},
      company: {},
      location: {},
    };

    for (const swipe of swipes) {
      const alumni = alumniMap.get(swipe.alumni_id);
      if (!alumni) continue;
      const delta = swipe.action === 'save' ? 4 : -2;

      if (alumni.industry) {
        weights.industry[alumni.industry] = (weights.industry[alumni.industry] ?? 0) + delta;
      }
      if (alumni.sport) {
        weights.sport[alumni.sport] = (weights.sport[alumni.sport] ?? 0) + delta;
      }
      if (alumni.company) {
        weights.company[alumni.company] = (weights.company[alumni.company] ?? 0) + delta;
      }
      if (alumni.location) {
        weights.location[alumni.location] = (weights.location[alumni.location] ?? 0) + delta;
      }
    }

    // Clamp adaptive weights so they nudge but don't dominate
    for (const key of Object.keys(weights) as (keyof SwipeWeights)[]) {
      for (const subKey of Object.keys(weights[key])) {
        weights[key][subKey] = Math.max(-12, Math.min(12, weights[key][subKey]));
      }
    }

    return weights;
  } catch {
    return {};
  }
}

export async function fetchRecommendations(
  userId: string,
  prefs: UserPreferences,
  limit = 30,
): Promise<ScoredAlumni[]> {
  try {
    const { data: swipes } = await supabase
      .from('alumni_swipes')
      .select('alumni_id')
      .eq('user_id', userId);

    const swipedIds = new Set((swipes ?? []).map((s) => s.alumni_id));

    const { data: network } = await supabase
      .from('user_networks')
      .select('alumni_id')
      .eq('user_id', userId);

    const networkedIds = new Set((network ?? []).map((n) => n.alumni_id));
    const excludeIds = new Set([...swipedIds, ...networkedIds]);

    // Order by prestige_score DESC at the database level so the candidate
    // pool itself is biased toward top-tier alumni. Client-side ranking
    // still applies on top, but at least we're scoring the right pool.
    // (Migration 016 created the alumni_prestige_score_idx for this query.)
    const { data: alumniData, error } = await supabase
      .from('alumni')
      .select('*')
      .eq('is_public', true)
      .order('prestige_score', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(500);

    if (error || !alumniData) return [];

    const unseen = alumniData.filter((a) => !excludeIds.has(a.id));

    const swipeWeights = await computeSwipeWeights(userId);

    const allScored = unseen.map((a) => scoreAlumnus(a as Alumni, prefs, swipeWeights));

    const highQuality = allScored
      .filter((s) => isHighQualityAlumniProfile(s.profile, QUALITY_THRESHOLD))
      .sort((a, b) => b.score - a.score);

    if (highQuality.length >= 5) {
      return highQuality.slice(0, limit);
    }

    // Fallback: relax quality bar so we never show an empty deck just because
    // enrichment is sparse — but never below the soft floor.
    const fallback = allScored
      .filter((s) => isHighQualityAlumniProfile(s.profile, QUALITY_FALLBACK_THRESHOLD))
      .sort((a, b) => b.score - a.score);

    return fallback.slice(0, limit);
  } catch {
    return [];
  }
}

export async function fetchUserPreferences(userId: string): Promise<UserPreferences> {
  const defaults: UserPreferences = {
    industries: [],
    sports: [],
    locations: [],
    roles: [],
    companies: [],
    priorities: {
      sameSport: true,
      similarIndustry: true,
      seniorAlumni: false,
    },
  };

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return defaults;

    return {
      industries: data.industries ?? [],
      sports: data.sports ?? [],
      locations: data.locations ?? [],
      roles: data.roles ?? [],
      companies: data.companies ?? [],
      graduationYearMin: data.graduation_year_min ?? undefined,
      graduationYearMax: data.graduation_year_max ?? undefined,
      priorities: data.priorities ?? defaults.priorities,
    };
  } catch {
    return defaults;
  }
}

export async function saveUserPreferences(
  userId: string,
  prefs: UserPreferences,
): Promise<void> {
  try {
    await supabase.from('user_preferences').upsert({
      user_id: userId,
      industries: prefs.industries,
      sports: prefs.sports,
      locations: prefs.locations,
      roles: prefs.roles,
      companies: prefs.companies ?? [],
      graduation_year_min: prefs.graduationYearMin ?? null,
      graduation_year_max: prefs.graduationYearMax ?? null,
      priorities: prefs.priorities,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Table may not exist yet — fail gracefully
  }
}

export async function recordSwipe(
  userId: string,
  alumniId: string,
  action: 'save' | 'pass',
): Promise<void> {
  try {
    await supabase.from('alumni_swipes').upsert({
      user_id: userId,
      alumni_id: alumniId,
      action,
      created_at: new Date().toISOString(),
    });

    if (action === 'save') {
      await supabase.from('user_networks').upsert({
        user_id: userId,
        alumni_id: alumniId,
        contacted: false,
        created_at: new Date().toISOString(),
      });
    }
  } catch {
    // Fail gracefully
  }
}
