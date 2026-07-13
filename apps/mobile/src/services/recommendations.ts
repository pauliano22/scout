import { supabase } from '../lib/supabase';
import { authedFetch } from '../lib/api';
import type { Alumni } from '../types/database';
import {
  deriveTargetDbIndustries,
  selectRecommendations,
  type ScoredAlumni,
  type SwipeWeights,
  type UserPreferences,
  type WarmPathSummary,
} from '@scout/shared/scoring/recommendationScoring';

// Explicit alumni columns for direct reads — never select('*') on alumni.
// Two reasons: '*' drags the pgvector embedding (1536 floats/row), and it
// ships contact info (email, linkedin_url) the alum may not have consented to
// share with students. Contact info must only reach mobile through the
// consent-gated web API payloads, never a direct table read.
export const ALUMNI_READ_COLS =
  'id, full_name, sport, graduation_year, company, role, industry, location, avatar_url, photo_url, is_verified, is_public, source, school_id, created_at, updated_at, work_history, skills, education, display_headline, path_summary_stub, current_status_type, bio, advice, engagement_intent, prestige_score';

// Warm paths for a candidate shortlist: who in the student's saved network was
// on campus with each candidate. Server-computed; empty map on any failure so
// the deck never depends on it.
async function fetchWarmPaths(alumniIds: string[]): Promise<Record<string, WarmPathSummary>> {
  if (alumniIds.length === 0) return {};
  try {
    const res = await authedFetch('/api/alumni/warm-paths', {
      method: 'POST',
      body: JSON.stringify({ alumniIds }),
    });
    if (!res.ok) return {};
    const body = (await res.json()) as { paths?: Record<string, WarmPathSummary> };
    return body.paths ?? {};
  } catch {
    return {};
  }
}

// Re-export the scoring types so existing imports from this module keep working.
export type {
  ScoreBreakdown,
  ScoredAlumni,
  SwipeWeights,
  UserPreferences,
} from '@scout/shared/scoring/recommendationScoring';

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

    // Two-pass fetch so interest-matched alumni are never crowded out by
    // prestige-heavy pools that don't match the user's stated interests.
    //
    // Pass 1: all public alumni whose industry is in the user's target set.
    //         No size limit — we want every match, not just the top-N.
    // Pass 2: prestige-ordered fallback pool to fill the rest of the deck.
    //         Deduped against pass-1 results inside selectRecommendations.
    const targetDbIndustries = deriveTargetDbIndustries(prefs.industries);

    let pass1: Alumni[] = [];
    if (targetDbIndustries.length > 0) {
      const { data } = await supabase
        .from('alumni')
        .select(ALUMNI_READ_COLS)
        .eq('is_public', true)
        .in('industry', targetDbIndustries);
      // Narrower row than Alumni by design: contact + consent columns are
      // intentionally never selected on this client.
      pass1 = (data ?? []) as unknown as Alumni[];
    }

    const { data: pass2Data, error } = await supabase
      .from('alumni')
      .select(ALUMNI_READ_COLS)
      .eq('is_public', true)
      .order('prestige_score', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(500);

    if (error) return [];

    const swipeWeights = await computeSwipeWeights(userId);

    const base = {
      pass1,
      pass2: (pass2Data ?? []) as unknown as Alumni[],
      excludeIds,
      prefs,
      swipeWeights,
    };

    // Two-stage: shortlist on fit, check the shortlist for warm paths through
    // the saved network, then rescore so reachable alumni rank (and explain)
    // accordingly. The 200-id shortlist gives the +18 boost room to promote.
    const shortlist = selectRecommendations({ ...base, limit: 200 });
    const warmPaths = await fetchWarmPaths(shortlist.map((s) => s.id));
    if (Object.keys(warmPaths).length === 0) return shortlist.slice(0, limit);

    return selectRecommendations({ ...base, warmPaths, limit });
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

export async function undoSwipe(
  userId: string,
  alumniId: string,
  action: 'save' | 'pass',
): Promise<void> {
  try {
    await supabase
      .from('alumni_swipes')
      .delete()
      .eq('user_id', userId)
      .eq('alumni_id', alumniId);

    if (action === 'save') {
      await supabase
        .from('user_networks')
        .delete()
        .eq('user_id', userId)
        .eq('alumni_id', alumniId);
    }
  } catch {
    // Fail gracefully
  }
}
