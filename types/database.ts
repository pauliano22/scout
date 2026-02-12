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
  is_verified: boolean
  is_public: boolean
  source: 'opt_in' | 'public_record' | 'referral'
  school_id: string | null
  created_at: string
  updated_at: string
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
  // Joined data
  alumni?: Alumni
  status?: 'interested' | 'awaiting_reply' | 'response_needed' | 'meeting_scheduled' | 'met'
  interactions?: string | null
}

export interface Message {
  id: string
  user_id: string
  alumni_id: string
  message_content: string
  sent_via: 'linkedin' | 'email' | 'copied'
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
  plan_id: string
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

export type Industry = 'Finance' | 'Technology' | 'Consulting' | 'Healthcare' | 'Law' | 'Media'

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
