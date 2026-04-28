import type { Alumni, EducationEntry, WorkHistoryEntry } from '../types/database';

export interface NormalizedAlumni {
  id: string;
  name: string;
  firstName: string;
  photoUrl: string | null;
  headline: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  industry: string | null;
  location: string | null;
  sport: string | null;
  graduationYear: number | null;
  bio: string | null;
  linkedinUrl: string | null;
  email: string | null;
  pastExperiences: WorkHistoryEntry[];
  education: EducationEntry[];
  skills: string[];
  profileCompletenessScore: number;
}

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (['null', 'undefined', 'n/a', '-'].includes(trimmed.toLowerCase())) return null;
  return trimmed;
}

function pickFirst(...values: unknown[]): string | null {
  for (const v of values) {
    const c = clean(v);
    if (c) return c;
  }
  return null;
}

function firstNameOf(name: string): string {
  const part = name.trim().split(/\s+/)[0] ?? name;
  return part;
}

function pickFirstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
    if (typeof v === 'string') {
      const parsed = parseInt(v, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

/**
 * Normalize a raw alumni row into a stable shape the UI can rely on.
 * Reads from a wide variety of possible field names so enrichment data
 * landing under different keys still surfaces in the app.
 */
export function normalizeAlumniProfile(input: Alumni | (Record<string, unknown> & Pick<Alumni, 'id'>)): NormalizedAlumni {
  const a = input as Record<string, unknown> & Pick<Alumni, 'id'>;

  const name =
    pickFirst(a.full_name, a.name, [a.first_name, a.last_name].filter(Boolean).join(' ')) ??
    'Cornell Alumnus';

  const photoUrl = pickFirst(
    a.photo_url,
    a.avatar_url,
    a.headshot_url,
    a.profile_photo_url,
    a.image_url,
  );

  const currentRole = pickFirst(
    a.role,
    a.current_role,
    a.current_title,
    a.title,
    a.position,
    a.job_title,
  );

  const currentCompany = pickFirst(
    a.company,
    a.current_company,
    a.employer,
    a.organization,
  );

  const industry = pickFirst(a.industry, a.primary_industry, a.sector);

  const locationParts = [a.location, a.city, a.state, a.country, a.region]
    .map((v) => clean(v))
    .filter(Boolean) as string[];
  const location = pickFirst(a.location, locationParts.join(', '));

  const sport = pickFirst(a.sport, a.team);

  const graduationYear = pickFirstNumber(a.graduation_year, a.class_year, a.grad_year);

  const headline = pickFirst(a.display_headline, a.headline, a.tagline);

  const bio = pickFirst(
    a.path_summary_stub,
    a.bio,
    a.about,
    a.summary,
    a.career_summary,
    headline,
  );

  const linkedinUrl = pickFirst(a.linkedin_url, a.linkedin, a.linkedin_profile);
  const email = pickFirst(a.email, a.contact_email);

  const pastExperiences = asArray<WorkHistoryEntry>(
    a.work_history ?? a.past_experiences ?? a.previous_roles ?? a.experience,
  ).filter((entry) => entry && (entry.title || entry.company));

  const education = asArray<EducationEntry>(a.education).filter((e) => e && e.school);
  const skills = asArray<string>(a.skills).map((s) => clean(s) ?? '').filter(Boolean);

  const score = computeCompleteness({
    currentRole,
    currentCompany,
    industry,
    location,
    bio,
    linkedinUrl,
    photoUrl,
    pastExperiences,
    education,
    sport,
    graduationYear,
  });

  return {
    id: String(a.id),
    name,
    firstName: firstNameOf(name),
    photoUrl,
    headline,
    currentRole,
    currentCompany,
    industry,
    location,
    sport,
    graduationYear,
    bio,
    linkedinUrl,
    email,
    pastExperiences,
    education,
    skills,
    profileCompletenessScore: score,
  };
}

interface CompletenessInput {
  currentRole: string | null;
  currentCompany: string | null;
  industry: string | null;
  location: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  photoUrl: string | null;
  pastExperiences: unknown[];
  education: unknown[];
  sport: string | null;
  graduationYear: number | null;
}

function computeCompleteness(p: CompletenessInput): number {
  let score = 0;
  if (p.currentRole) score += 20;
  if (p.currentCompany) score += 20;
  if (p.industry) score += 10;
  if (p.location) score += 10;
  if (p.bio) score += 15;
  if (p.linkedinUrl) score += 10;
  if (p.photoUrl) score += 10;
  if (p.pastExperiences.length > 0) score += 20;
  if (p.education.length > 0) score += 5;
  if (p.sport || p.graduationYear) score += 5;
  return Math.min(score, 125);
}

export function getProfileCompletenessScore(
  input: Alumni | NormalizedAlumni,
): number {
  if ('profileCompletenessScore' in input) return input.profileCompletenessScore;
  return normalizeAlumniProfile(input).profileCompletenessScore;
}

/**
 * Returns true if the alumni profile has enough information to be useful in
 * Discover. Hides nearly-empty rows so we never render a card with just a name.
 */
export function isHighQualityAlumniProfile(
  input: Alumni | NormalizedAlumni,
  threshold = 45,
): boolean {
  const profile = 'profileCompletenessScore' in input ? input : normalizeAlumniProfile(input);

  if (!profile.name || profile.name === 'Cornell Alumnus') return false;

  const signals: boolean[] = [
    !!profile.currentRole,
    !!profile.currentCompany,
    !!profile.industry,
    !!profile.location,
    !!profile.linkedinUrl,
    !!profile.bio,
    profile.pastExperiences.length > 0,
    profile.education.length > 0,
    !!profile.graduationYear,
    !!profile.sport,
  ];

  const trueCount = signals.filter(Boolean).length;
  if (trueCount < 2) return false;

  return profile.profileCompletenessScore >= threshold;
}

export function formatGradYearShort(year: number | null): string | null {
  if (!year) return null;
  return `'${String(year).slice(-2)}`;
}

export function formatExperienceDates(entry: WorkHistoryEntry): string | null {
  if (entry.duration) return entry.duration;
  const startYear = entry.start?.year;
  const endYear = entry.end?.year;
  if (startYear && endYear) return `${startYear} – ${endYear}`;
  if (startYear) return `${startYear} – Present`;
  return null;
}
