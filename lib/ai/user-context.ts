import { Profile } from '@/types/database'

/**
 * Builds a formatted user context block from their profile/onboarding data.
 * Used as the single source of truth for all AI prompts so Claude has
 * full context on the user when generating recommendations, talking points, and messages.
 */
export function buildUserContext(profile: Profile): string {
  const stageLabels: Record<string, string> = {
    exploring: 'Exploring career options — not yet sure what industry or role they want',
    recruiting: 'Actively recruiting — applying to jobs and looking for opportunities',
    interviewing: 'In the interview process — has active applications and interviews lined up',
    referrals: 'Looking for referrals — wants warm intros and connections at specific companies',
    relationship_building: 'Relationship building — focused on long-term networking, not immediate job search',
  }

  const networkLabels: Record<string, string> = {
    none: 'No alumni networking experience yet — this is their first time reaching out',
    few_conversations: 'Has had a few networking conversations but still early in the process',
    ongoing: 'Has an ongoing networking practice and is comfortable reaching out to new people',
  }

  const intensityLabels: Record<string, string> = {
    '20': 'Aggressive networker — wants to connect with ~20 people per week',
    '10': 'Active networker — aiming for ~10 connections per week',
    '5': 'Moderate pace — about 5 connections per week',
    own_pace: 'Prefers to go at their own pace, no specific weekly target',
  }

  const lines = [
    `- Name: ${profile.full_name || 'Student'}`,
    `- Sport: ${profile.sport || 'N/A'}`,
    `- Graduation Year: ${profile.graduation_year || 'N/A'}`,
    `- Major: ${profile.major || 'N/A'}`,
    `- Primary Industry Interest: ${profile.primary_industry || 'Open to all'}`,
    `- Target Roles: ${profile.target_roles?.join(', ') || 'Open to all'}`,
    `- Secondary Industries: ${profile.secondary_industries?.join(', ') || 'None'}`,
    `- Current Stage: ${stageLabels[profile.current_stage || ''] || profile.current_stage || 'Exploring'}`,
    `- Networking Experience: ${networkLabels[profile.existing_network || ''] || 'Unknown'}`,
    `- Networking Pace: ${intensityLabels[profile.networking_intensity || ''] || 'Own pace'}`,
    `- Past Experience: ${profile.past_experience || 'None listed'}`,
    `- Location Preference: ${profile.geography_preference || 'doesnt_matter'}${profile.preferred_locations?.length ? ' (' + profile.preferred_locations.join(', ') + ')' : ''}`,
  ]

  // Include current company/role if they have one (from profile, not onboarding)
  if (profile.company || profile.role) {
    lines.push(`- Current Position: ${profile.role || ''} ${profile.company ? 'at ' + profile.company : ''}`.trim())
  }

  return lines.join('\n')
}
