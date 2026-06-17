import type { UserRole } from '@scout/shared/types/database'

export function postLoginPath(
  role: UserRole | null | undefined,
  onboardingCompleted: boolean,
): string {
  if (!onboardingCompleted) return '/onboarding'
  switch (role) {
    case 'alumni':
      return '/profile'
    case 'admin':
      return '/admin'
    case 'student':
    default:
      // The agentic picks page is the single student home.
      return '/campaign'
  }
}
