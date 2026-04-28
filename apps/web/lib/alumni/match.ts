import type { SupabaseClient } from '@supabase/supabase-js'

export interface AlumniMatchInput {
  full_name: string
  email?: string | null
  sport?: string | null
  graduation_year?: number | null
}

export interface AlumniMatchResult {
  id: string
  match_strategy: 'email' | 'name_sport_year' | 'name_year'
}

/**
 * Tiered match: email → name+sport+year → name+year. Returns the first hit.
 * Mirrors the historical logic in app/api/alumni/submit/route.ts so that the
 * legacy /join endpoint and the new /api/alumni/match share one source of truth.
 */
export async function findAlumniMatch(
  supabase: SupabaseClient,
  input: AlumniMatchInput,
): Promise<AlumniMatchResult | null> {
  const fullName = input.full_name.trim()
  const email = input.email?.trim() || ''
  const sport = input.sport?.trim() || ''
  const gradYear = input.graduation_year ?? null

  if (email) {
    const { data } = await supabase
      .from('alumni')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (data?.id) return { id: data.id, match_strategy: 'email' }
  }

  if (fullName && sport && gradYear) {
    const { data } = await supabase
      .from('alumni')
      .select('id')
      .ilike('full_name', fullName)
      .eq('graduation_year', gradYear)
      .eq('sport', sport)
      .maybeSingle()
    if (data?.id) return { id: data.id, match_strategy: 'name_sport_year' }
  }

  if (fullName && gradYear) {
    const { data } = await supabase
      .from('alumni')
      .select('id')
      .ilike('full_name', fullName)
      .eq('graduation_year', gradYear)
      .maybeSingle()
    if (data?.id) return { id: data.id, match_strategy: 'name_year' }
  }

  return null
}
