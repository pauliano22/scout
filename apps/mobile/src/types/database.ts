// Per CLAUDE.md: "All shared DB types live in packages/shared/types/database.ts.
// Neither app may define its own copy of Supabase row types." Alumni and related
// row types are re-exported from the canonical shared module so the unified
// scorer in @scout/shared/scoring works on the same shape as mobile code.
// (Profile/UserNetwork still defined locally below — a separate cleanup; their
// shared versions are a near-superset and should replace these next.)
import type {
  Alumni,
  AlumniClaimSource,
  EducationEntry,
  WorkHistoryEntry,
} from '@scout/shared/types/database';
export type { Alumni, AlumniClaimSource, EducationEntry, WorkHistoryEntry };

export interface Profile {
  id: string
  email: string
  full_name: string | null
  sport: string | null
  graduation_year: number | null
  interests: string | null
  company: string | null
  role: string | null
  industry: string | null
  location: string | null
  linkedin_url: string | null
  avatar_url: string | null
  is_alumni: boolean
  is_verified: boolean
  school_id: string | null
  primary_industry: string | null
  target_roles: string[]
  secondary_industries: string[]
  networking_intensity: '20' | '10' | '5' | 'own_pace'
  current_stage: 'exploring' | 'recruiting' | 'interviewing' | 'referrals' | 'relationship_building'
  existing_network: 'none' | 'few_conversations' | 'ongoing'
  major: string | null
  past_experience: string | null
  preferred_locations: string[]
  geography_preference: 'city' | 'region' | 'doesnt_matter'
  onboarding_completed: boolean
  resume_url: string | null
  resume_parsed: Record<string, unknown> | null
  alumni_id: string | null
  account_role: 'student' | 'alumni' | 'admin'
  team: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface UserNetwork {
  id: string
  user_id: string
  alumni_id: string
  contacted: boolean
  contacted_at: string | null
  notes: string | null
  created_at: string
  alumni?: Alumni
  status?: string
}
