export interface WorkHistoryEntry {
  title:    string | null
  company:  string | null
  start:    { year: number; month?: number } | null
  end:      { year: number; month?: number } | null
  duration: string | null
  location: string | null
}

export interface EducationEntry {
  school: string
  degree: string | null
  field:  string | null
  start:  number | null
  end:    number | null
}

export type AlumniClaimSource = 'self_signup' | 'admin' | 'opt_in'

export interface Alumni {
  id: string
  full_name: string
  email: string | null
  linkedin_url: string | null
  sport: string
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
  work_history:        WorkHistoryEntry[] | null
  skills:              string[] | null
  education:           EducationEntry[] | null
  display_headline:    string | null
  path_summary_stub:   string | null
  current_status_type: 'current' | 'likely_current' | 'last_known' | 'conflicting' | 'unknown' | null
  // Self-serve + claim (mig 018)
  bio:                          string | null
  advice:                       string | null
  share_email_with_students:    boolean
  is_claimed:                   boolean
  claimed_at:                   string | null
  claim_source:                 AlumniClaimSource | null
  claimed_by_user_id:           string | null
  profile_reviewed_by_alumni:   boolean
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
  // Intake / onboarding fields
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
  // Migration 015 — `role` above is the user's job title (legacy).
  // `account_role` is the permission role used by auth/RLS.
  account_role: UserRole
  team: TeamCode | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

// =====================================================================
// Migration 035 — Ambassador Program / Varsity Badges
// =====================================================================

export type AmbassadorTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type AmbassadorBadgeType = 'varsity' | 'captain' | 'hall_of_fame'

export interface AmbassadorProfile {
  id: string
  user_id: string
  alumni_id: string | null
  tier: AmbassadorTier
  sport: string
  badge_type: AmbassadorBadgeType
  benefits_access: Record<string, unknown>
  recruits_count: number
  mentorship_hours: number
  referrals_count: number
  is_active: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined data
  profiles?: Profile
  alumni?: Alumni
}

export interface UserNetwork {
  id: string
  user_id: string
  alumni_id: string
  contacted: boolean
  contacted_at: string | null
  meeting_at: string | null
  notes: string | null
  created_at: string
  // status is a real column (unified in migration 025; 'proposed' added in 026);
  // kept optional so existing constructors that omit it still typecheck.
  status?: 'proposed' | 'interested' | 'awaiting_reply' | 'response_needed' | 'meeting_scheduled' | 'met' | 'not_interested'
  // Joined data
  alumni?: Alumni
  interactions?: string | null
}

export interface Message {
  id: string
  user_id: string
  alumni_id: string
  message_content: string
  sent_via: 'linkedin' | 'email' | 'copied' | 'marked'
  created_at: string
}

export interface School {
  id: string
  name: string
  slug: string
  display_name: string
  primary_color: string
  secondary_color: string
  logo_url: string | null
  is_active: boolean
  created_at: string
}

export interface NetworkingPlan {
  id: string
  user_id: string
  title: string
  goal_count: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Campaign columns (migration 026 — the agentic between-login loop)
  goal_metric: 'informational_interview' | 'referral' | 'mentor_relationship'
  deadline: string | null // ISO date
  campaign_status: 'active' | 'completed' | 'paused'
  current_count: number
  last_tick_at: string | null
  last_sourced_at: string | null
  sourcing_enabled: boolean
  // Joined data
  plan_alumni?: PlanAlumni[]
  custom_contacts?: PlanCustomContact[]
}

export interface PlanAlumni {
  id: string
  plan_id: string
  alumni_id: string
  ai_career_summary: string | null
  ai_talking_points: string[]
  ai_recommendation_reason: string | null
  ai_company_bio: string | null
  status: 'active' | 'not_interested' | 'contacted'
  sort_order: number
  created_at: string
  updated_at: string
  // Joined data
  alumni?: Alumni
}

export interface PlanCustomContact {
  id: string
  plan_id: string | null
  user_id: string
  name: string
  company: string | null
  role: string | null
  linkedin_url: string | null
  notes: string | null
  status: 'active' | 'not_interested' | 'contacted'
  created_at: string
  updated_at: string
}

export interface AlumniFilters {
  search?: string
  industry?: string
  sport?: string
  company?: string
  school_id?: string
}

export type IndustryCategory =
  | 'Finance'
  | 'Consulting'
  | 'Technology'
  | 'Law'
  | 'Medicine'
  | 'Sports'
  | 'Education'
  | 'Media'
  | 'Real Estate'
  | 'Non-Profit'
  | 'Government'
  | 'Other'

export type Industry = 'Finance' | 'Technology' | 'Consulting' | 'Healthcare' | 'Law' | 'Media'

export interface CompanyAlias {
  id: string
  canonical_name: string
  alias: string
  created_at: string
}

export type Sport =
  | 'Basketball'
  | 'Soccer'
  | 'Football'
  | 'Lacrosse'
  | 'Tennis'
  | 'Swimming'
  | 'Baseball'
  | 'Volleyball'
  | 'Hockey'
  | 'Track & Field'
  | 'Rowing'
  | 'Wrestling'
  | 'Golf'
  | 'Field Hockey'
  | 'Cross Country'
  | 'Fencing'
  | 'Gymnastics'

export interface SportNormalization {
  canonical_name: string
  aliases: string[]
  category: 'team' | 'individual'
  contact_type: 'contact' | 'non-contact'
  level: 'varsity' | 'club' | 'intramural'
  created_at: string
  updated_at: string
}

export type SportCategory = SportNormalization['category']
export type SportContactType = SportNormalization['contact_type']
export type SportLevel = SportNormalization['level']

export interface UserEvent {
  id: string
  user_id: string
  event_type: string
  event_data: Record<string, any>
  created_at: string
}

export interface Interaction {
  id: string
  user_id: string
  alumni_id: string
  network_id: string | null
  type: 'email' | 'linkedin' | 'phone' | 'coffee' | 'video_call' | 'in_person' | 'other'
  title: string | null
  notes: string | null
  interaction_date: string
  created_at: string
  updated_at: string
}

// =====================================================================
// Migration 015 — roles, teams, events, opportunities
// =====================================================================

export type UserRole = 'student' | 'alumni' | 'admin'
export type TeamCode = 'football'

// =====================================================================
// Migration 035 — Event QR Connection Network
// =====================================================================

export interface EventChatSession {
  id: string
  event_id: string | null
  sport: string
  name: string
  code: string
  start_time: string
  end_time: string | null
  is_active: boolean
  qr_code_url: string | null
  created_at: string
}

export interface EventParticipant {
  id: string
  session_id: string
  user_id: string
  joined_at: string
  display_name: string | null
}

export interface EventChatMessage {
  id: string
  session_id: string
  user_id: string
  display_name: string | null
  content: string
  created_at: string
}
export type EventKind = 'networking' | 'panel' | 'workshop' | 'game_day' | 'other'
export type EventVisibility = 'team' | 'all'
export type RsvpStatus = 'going' | 'maybe' | 'declined'
export type OpportunityKind = 'job' | 'internship' | 'mentorship' | 'referral' | 'other'

export interface Team {
  code: TeamCode
  display_name: string
  sport: string
  created_at: string
}

export interface Event {
  id: string
  team: TeamCode | null
  kind: EventKind
  visibility: EventVisibility
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  host_profile_id: string | null
  capacity: number | null
  is_cancelled: boolean
  created_at: string
  updated_at: string
}

export interface EventRsvp {
  event_id: string
  profile_id: string
  status: RsvpStatus
  created_at: string
  updated_at: string
}

export interface Opportunity {
  id: string
  posted_by: string
  team: TeamCode | null
  kind: OpportunityKind
  title: string
  body: string | null
  company: string | null
  location: string | null
  url: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OpportunitySave {
  opportunity_id: string
  profile_id: string
  created_at: string
}

export interface RoleChangeLogEntry {
  id: number
  profile_id: string
  old_role: UserRole | null
  new_role: UserRole
  changed_by: string | null
  changed_at: string
}

// =====================================================================
// Bio Keyword Extraction (IDEA 62)
// =====================================================================

export type KeywordCategory = 'skill' | 'industry' | 'certification' | 'milestone'

export interface ProfileKeyword {
  id: string
  alumni_id: string
  keyword: string
  category: KeywordCategory
  source: string
  created_at: string
}

// =====================================================================
// Census gap analysis
// =====================================================================

export interface CensusReport {
  id: string
  generated_at: string
  sport: string
  graduation_year: number
  total_rostered: number
  total_registered: number
  coverage_pct: number
  gap_category: 'critical' | 'growing' | 'healthy'
  created_at: string
}

export type GapCategory = 'critical' | 'growing' | 'healthy'

// =====================================================================
// Feature Flags (migration 035)
// =====================================================================

export interface FeatureFlag {
  flag_name: string
  enabled: boolean
  rollout_percentage: number
  created_at: string
  updated_at: string
}

// =====================================================================
// Onboarding progress (bundled with sport-name-normalization branch)
// =====================================================================

export type OnboardingStep = 'add_photo' | 'complete_bio' | 'first_connection' | 'first_message'

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'add_photo',
  'complete_bio',
  'first_connection',
  'first_message',
]

export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  add_photo: 'Add a photo',
  complete_bio: 'Complete your bio',
  first_connection: 'Find your first teammate',
  first_message: 'Send your first message',
}

export interface OnboardingProgress {
  user_id: string
  has_photo: boolean
  has_bio: boolean
  has_first_connection: boolean
  has_first_message: boolean
  completed_steps: OnboardingStep[]
  updated_at?: string
}

// =====================================================================
// Migration 035 — Graduation Year Verification Pipeline
// =====================================================================

export type VerificationStatus = 'verified' | 'mismatch' | 'unverified' | 'pending'

export interface GraduationVerification {
  id: string
  alumni_id: string
  reported_year: number
  roster_year: number | null
  match_status: VerificationStatus
  reviewed: boolean
  flagged_at: string | null
  created_at: string
  updated_at: string
  // Joined data
  alumni?: Alumni
}

// =====================================================================
// Security Incident Logging (IDEA 58)
// =====================================================================

export interface SecurityEvent {
  id: string
  event_type: string
  severity: 'info' | 'warning' | 'critical'
  source_ip: string | null
  user_id: string | null
  details: Record<string, unknown>
  acknowledged: boolean
  created_at: string
}

export interface SecurityAlert {
  id: string
  rule_name: string
  threshold: number
  actual_count: number
  events: SecurityEvent[]
  acknowledged: boolean
  acknowledged_by: string | null
  created_at: string
}
