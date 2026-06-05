import type { UserRole } from '@scout/shared/types/database'
import { isInCampaignHome } from '@scout/shared/featureFlags/campaignHome'

export function postLoginPath(
  role: UserRole | null | undefined,
  onboardingCompleted: boolean,
  userId?: string | null,
): string {
  if (!onboardingCompleted) return '/onboarding'
  switch (role) {
    case 'alumni':
      return '/profile'
    case 'admin':
      return '/admin'
    case 'student':
    default:
      // Students in the campaign-home rollout land on the agentic home;
      // everyone else keeps the existing Plan/search landing.
      return isInCampaignHome(userId) ? '/campaign' : '/plan'
  }
}
