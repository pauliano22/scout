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
  is_verified: boolean
  is_public: boolean
  source: 'opt_in' | 'public_record' | 'referral'
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
  is_alumni: boolean
  is_verified: boolean
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
}

export interface Message {
  id: string
  user_id: string
  alumni_id: string
  message_content: string
  sent_via: 'linkedin' | 'email' | 'copied'
  created_at: string
}

export interface AlumniFilters {
  search?: string
  industry?: string
  sport?: string
  company?: string
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
