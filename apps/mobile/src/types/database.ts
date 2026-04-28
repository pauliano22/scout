// Local copy of shared database types for the mobile app
// Source of truth: packages/shared/types/database.ts

export interface WorkHistoryEntry {
  title: string | null
  company: string | null
  start: { year: number; month?: number } | null
  end: { year: number; month?: number } | null
  duration: string | null
  location: string | null
}

export interface EducationEntry {
  school: string
  degree: string | null
  field: string | null
  start: number | null
  end: number | null
}

export interface Alumni {
  id: string
  full_name: string
  email: string | null
  linkedin_url: string | null
  sport: string | null
  graduation_year: number
  company: string | null
  role: string | null
  industry: string | null
  location: string | null
  avatar_url: string | null
  photo_url: string | null
  is_verified: boolean
  is_public: boolean
  source: 'opt_in' | 'public_record' | 'referral'
  school_id: string | null
  created_at: string
  updated_at: string
  // Rich career fields
  work_history: WorkHistoryEntry[] | null
  skills: string[] | null
  education: EducationEntry[] | null
  display_headline: string | null
  path_summary_stub: string | null
  current_status_type: 'current' | 'likely_current' | 'last_known' | 'conflicting' | 'unknown' | null
  prestige_score?: number | null
}

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
