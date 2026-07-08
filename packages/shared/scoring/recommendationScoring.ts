// Pure recommendation scoring + candidate selection.
//
// Single source of truth for ranking alumni across Scout's surfaces:
//   - mobile Discover deck (apps/mobile/src/services/recommendations.ts)
//   - web "Scout Networking Agent" (apps/web/lib/agent/runScoutNetworkingAgent)
//   - the offline eval harness (evals/recommendations)
//
// This module deliberately has NO Supabase / network / react-native / next
// imports so it can run in any runtime. All I/O lives at the call sites.

import {
  isHighQualityAlumniProfile,
  normalizeAlumniProfile,
  type NormalizedAlumni,
} from '../profile/alumniProfile';
import type { Alumni } from '../types/database';
import { INTEREST_ALIASES, INTEREST_DB_INDUSTRIES } from '../constants/interests';

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
  warmIntro: number;
  engagementIntent: number;
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

/**
 * A warm path into one alum: someone already in the student's saved network
 * who was on campus with them. Computed server-side (POST /api/alumni/warm-paths)
 * against the baked overlap dataset and passed in — this module stays pure.
 */
export interface WarmPathSummary {
  count: number;
  topName: string;
  topRelation: 'teammate' | 'same_era';
}

export const BASE_WEIGHTS = {
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
  // A reachable alum beats a marginally better-matched stranger: a teammate
  // of someone the student already saved is a door that actually opens.
  warmIntro: 18,
  // Self-declared receptivity (alumni.engagement_intent, mig 056). Positive
  // for here_to_help/both, NEGATIVE for seeking_employment — a fellow seeker
  // shouldn't be pitched as an intro target. Below warmIntro: a known door
  // still beats a willing stranger.
  engagementIntent: 12,
};

export const QUALITY_THRESHOLD = 50;
export const QUALITY_FALLBACK_THRESHOLD = 30;

function ciIncludes(haystack: string | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function ciEquals(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

// Seniority/rank words that exist in every field ("Director", "Manager", …).
// A role preference that is ONLY one of these matches across all industries —
// e.g. a nonprofit seeker's "Director" matching a finance "Managing Director" —
// so it must not, on its own, count as a role match.  Substantive role words
// (Engineer, Attorney, Producer, …) are intentionally NOT here.
const GENERIC_ROLE_TOKENS = new Set([
  'director', 'managing director', 'executive director', 'manager', 'executive',
  'senior', 'junior', 'vp', 'svp', 'evp', 'vice president', 'president', 'chief',
  'head', 'lead', 'principal', 'officer', 'coordinator', 'associate', 'staff',
  'intern', 'fellow', 'member', 'partner', 'owner', 'founder',
  'ceo', 'cfo', 'coo', 'cto',
]);

function isGenericRoleToken(role: string): boolean {
  return GENERIC_ROLE_TOKENS.has(role.trim().toLowerCase());
}

function computeWhyThisMatch(
  profile: NormalizedAlumni,
  prefs: UserPreferences,
  breakdown: ScoreBreakdown,
  warmPath?: WarmPathSummary,
): string[] {
  const reasons: string[] = [];
  const history = profile.pastExperiences;

  // A warm path always leads: it's the one reason that changes what the
  // student should DO (ask for an intro instead of cold-outreach).
  if (warmPath) {
    const verb = warmPath.topRelation === 'teammate' ? 'played with them' : 'was on campus with them';
    reasons.push(
      warmPath.count > 1
        ? `${warmPath.topName} +${warmPath.count - 1} more in your network can introduce you`
        : `${warmPath.topName} in your network ${verb}`,
    );
  }

  // Declared receptivity is the next-best actionable reason: this alum
  // explicitly asked to hear from student-athletes.
  if (breakdown.engagementIntent > 0) {
    reasons.push('Signed up to help student-athletes');
  }

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
    reasons.push(`Also played ${profile.sport}`);
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
    reasons.push(profile.currentCompany ? `Top-tier firm (${profile.currentCompany})` : 'Senior alum at a top-tier firm');
  }

  if (profile.graduationYear && reasons.length < 3) {
    const yearsOut = new Date().getFullYear() - profile.graduationYear;
    if (yearsOut >= 3 && yearsOut <= 8) {
      reasons.push(`${yearsOut} years out, recent enough for practical advice`);
    } else if (yearsOut >= 12) {
      reasons.push(`Senior alum with a strong perspective on hiring`);
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

// Recognizable employers, field-neutral. This is the *legitimate* half of the
// migration-016 prestige tiers (notable companies across finance, consulting,
// tech, sports, media) WITHOUT the industry-label bonus that handed every
// finance/sports alum a free 70/65. A finance analyst with no company now scores
// the same prestige as a teacher with no company; an alum at Google or ESPN
// still scores high because the *employer* is notable to a seeker in that field.
const RECOGNIZED_EMPLOYERS: Array<{ score: number; patterns: RegExp }> = [
  {
    score: 100,
    patterns:
      /goldman sachs|morgan stanley|jpmorgan|jp morgan|blackstone|blackrock|kkr|apollo|carlyle|citadel|two sigma|bridgewater|point72|d\.e\. shaw|renaissance technologies|warburg pincus|general atlantic|sequoia/i,
  },
  {
    score: 90,
    patterns:
      /mckinsey|boston consulting|\bbcg\b|bain|bank of america|merrill lynch|lazard|evercore|moelis|guggenheim|citigroup|\bciti\b|barclays|\bubs\b|deutsche bank|credit suisse|hsbc/i,
  },
  {
    score: 80,
    patterns:
      /deloitte|pwc|pricewaterhousecoopers|ernst & young|\bey\b|kpmg|accenture|oliver wyman|booz allen|google|apple|\bmeta\b|microsoft|amazon|wells fargo|fidelity|vanguard|charles schwab|jefferies|\brbc\b|piper sandler|stifel|raymond james|cowen|william blair|tpg|advent international|vista equity|ares management|brookfield|nfl|nba|mlb|nhl|mls|espn|nike|\bimg\b|\bcaa\b|endeavor|\bwme\b|wasserman|octagon/i,
  },
];

/**
 * Field-neutral prestige (0–100). Recognizable employer first, then a small
 * floor for having a complete-enough employment record. No industry input — this
 * is what removes the finance/sports head start while still surfacing alumni at
 * notable employers in any field.
 */
export function computeNeutralPrestige(
  company: string | null,
  role: string | null,
): number {
  if (company) {
    for (const tier of RECOGNIZED_EMPLOYERS) {
      if (tier.patterns.test(company)) return tier.score;
    }
    return role ? 40 : 20;
  }
  return 0;
}

/**
 * Returns whether an alumni's DB industry value matches any of the user's
 * saved interest labels, expanding through INTEREST_ALIASES so labels like
 * "Government / Policy" match alumni with industry="Government".
 */
export function industryMatchStrength(
  alumniIndustry: string | null,
  userInterests: string[],
): boolean {
  if (!alumniIndustry) return false;
  for (const interest of userInterests) {
    // Direct exact match handles both old format and new format that happen to match
    if (ciEquals(interest, alumniIndustry)) return true;
    // Alias expansion — maps user-friendly labels to DB taxonomy values
    const aliases = INTEREST_ALIASES[interest] ?? [interest];
    if (aliases.some((a) => ciEquals(a, alumniIndustry))) return true;
  }
  return false;
}

export function scoreAlumnus(
  alumni: Alumni,
  prefs: UserPreferences,
  swipeWeights: Partial<SwipeWeights>,
  warmPath?: WarmPathSummary,
): ScoredAlumni {
  const profile = normalizeAlumniProfile(alumni);
  const breakdown: ScoreBreakdown = {
    industry: 0,
    role: 0,
    warmIntro: 0,
    engagementIntent: 0,
    sport: 0,
    location: 0,
    company: 0,
    graduationYear: 0,
    completeness: 0,
    prestige: 0,
    total: 0,
  };

  // Industry match — uses alias expansion so "Government / Policy" matches
  // alumni with industry="Government" etc. similarIndustry toggle zeroes this out.
  if (profile.industry && prefs.industries.length > 0 && prefs.priorities.similarIndustry !== false) {
    if (industryMatchStrength(profile.industry, prefs.industries)) {
      const adj = swipeWeights.industry?.[profile.industry] ?? 0;
      breakdown.industry = Math.max(0, Math.min(BASE_WEIGHTS.industry + adj, 40));
    }
  }

  // Role match — ignore preferences that are bare seniority words, which match
  // every field's "Director"/"Manager"/etc. and leak off-field alumni in.
  if (profile.currentRole && prefs.roles.length > 0) {
    const meaningfulRoles = prefs.roles.filter((r) => !isGenericRoleToken(r));
    const matchesRole = meaningfulRoles.some(
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

  // Prestige — field-neutral notability (recognizable employer + profile depth).
  // We intentionally do NOT use alumni.prestige_score: migration 016 inflates it
  // for the finance/sports *industry label* alone, which buried every other field
  // (see docs/decisions/prestige-neutralization.md). Linear contribution.
  const prestigeRaw = computeNeutralPrestige(profile.currentCompany, profile.currentRole);
  const prestigeNormalized = Math.max(0, Math.min(prestigeRaw, 100)) / 100;
  breakdown.prestige = Math.round(prestigeNormalized * BASE_WEIGHTS.prestige);

  // Prestige only boosts alumni who match a field the seeker cares about. With
  // no industry match — whether because the alum is off-field, or because the
  // seeker stated no field at all — prestige contributes 0. Otherwise the
  // recognizable-employer signal (finance/consulting/tech-heavy) re-skews every
  // no-preference deck back toward finance. Filler is then ordered by the actual
  // fit signals: sport, location, role, completeness.
  if (breakdown.industry === 0) {
    breakdown.prestige = 0;
  }

  // Warm intro — full weight for a teammate-of-a-contact, partial for a
  // same-era overlap. Unlike prestige this is NOT gated on industry match:
  // reachability is valuable on its own.
  if (warmPath) {
    breakdown.warmIntro = warmPath.topRelation === 'teammate'
      ? BASE_WEIGHTS.warmIntro
      : Math.round(BASE_WEIGHTS.warmIntro * 0.5);
  }

  // Engagement intent — like warmIntro, NOT gated on industry: an alum who
  // signed up to help is a door that opens regardless of field. An alum who is
  // themselves job-hunting is actively down-ranked. NULL (every unclaimed
  // scraped row) contributes 0, so the pre-056 directory is unaffected.
  if (alumni.engagement_intent === 'here_to_help' || alumni.engagement_intent === 'both') {
    breakdown.engagementIntent = BASE_WEIGHTS.engagementIntent;
  } else if (alumni.engagement_intent === 'seeking_employment') {
    breakdown.engagementIntent = -BASE_WEIGHTS.engagementIntent;
  }

  breakdown.total =
    breakdown.warmIntro +
    breakdown.engagementIntent +
    breakdown.industry +
    breakdown.role +
    breakdown.sport +
    breakdown.location +
    breakdown.company +
    breakdown.graduationYear +
    breakdown.completeness +
    breakdown.prestige;

  const whyThisMatch = computeWhyThisMatch(profile, prefs, breakdown, warmPath);

  return {
    ...alumni,
    profile,
    score: breakdown.total,
    scoreBreakdown: breakdown,
    whyThisMatch,
  };
}

/**
 * Maps a user's saved interest labels to the exact DB `industry` values used by
 * the Pass-1 `.in()` filter. Falls back to the raw label when no mapping exists.
 */
export function deriveTargetDbIndustries(industries: string[]): string[] {
  return Array.from(
    new Set(industries.flatMap((ind) => INTEREST_DB_INDUSTRIES[ind] ?? [ind])),
  );
}

export interface SelectionInput {
  /** Pass-1 pool: alumni whose industry is in the user's target set. */
  pass1: Alumni[];
  /** Pass-2 pool: prestige-ordered fallback (may overlap pass1; deduped here). */
  pass2: Alumni[];
  excludeIds: Set<string>;
  prefs: UserPreferences;
  swipeWeights: Partial<SwipeWeights>;
  limit: number;
  /** alumniId -> warm path through the student's saved network (optional). */
  warmPaths?: Record<string, WarmPathSummary>;
}

/**
 * Pure deck selection: dedupe, exclude seen, score, apply the quality gate
 * (with the soft-floor fallback), and return the top `limit`. This is the exact
 * post-fetch logic from `fetchRecommendations`, factored out so the eval harness
 * and other surfaces exercise the same real path.
 */
export function selectRecommendations(input: SelectionInput): ScoredAlumni[] {
  const { pass1, pass2, excludeIds, prefs, swipeWeights, limit, warmPaths } = input;

  const pass1Ids = new Set(pass1.map((a) => a.id));
  const dedupedPass2 = pass2.filter((a) => !pass1Ids.has(a.id));
  const alumniData = [...pass1, ...dedupedPass2];

  const unseen = alumniData.filter((a) => !excludeIds.has(a.id));
  const allScored = unseen.map((a) => scoreAlumnus(a, prefs, swipeWeights, warmPaths?.[a.id]));

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
}
