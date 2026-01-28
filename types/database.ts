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
  interactions?: string | null  // Add this line
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

export interface UserStats {
  id: string
  user_id: string
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
  total_xp: number
  current_level: number
  total_connections: number
  total_messages_sent: number
  total_responses_received: number
  created_at: string
  updated_at: string
}

export interface Achievement {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  xp_reward: number
  requirement_type: 'streak' | 'connections' | 'messages' | 'responses'
  requirement_value: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  created_at: string
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  unlocked_at: string
  achievement?: Achievement
}

export interface DailyGoal {
  id: string
  user_id: string
  date: string
  connections_goal: number
  connections_made: number
  messages_goal: number
  messages_sent: number
  completed: boolean
  created_at: string
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

// Level thresholds
export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  500,    // Level 4
  850,    // Level 5
  1300,   // Level 6
  1850,   // Level 7
  2500,   // Level 8
  3250,   // Level 9
  4100,   // Level 10
]

export function getXpForNextLevel(currentXp: number, currentLevel: number): number {
  const nextLevelXp = LEVEL_THRESHOLDS[currentLevel] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 1000
  return nextLevelXp - currentXp
}

export function getXpProgress(currentXp: number, currentLevel: number): number {
  const currentLevelXp = LEVEL_THRESHOLDS[currentLevel - 1] || 0
  const nextLevelXp = LEVEL_THRESHOLDS[currentLevel] || currentLevelXp + 1000
  const progress = ((currentXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100
  return Math.min(100, Math.max(0, progress))
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