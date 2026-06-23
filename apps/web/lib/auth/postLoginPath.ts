import type { UserRole } from '@scout/shared/types/database'

export function postLoginPath(
  role: UserRole | null | undefined,
  onboardingCompleted: boolean,
  // Kept for signature compatibility with existing call sites.
  _userId?: string | null,
): string {
  if (!onboardingCompleted) return '/onboarding'
  switch (role) {
    case 'alumni':
      return '/profile'
    case 'admin':
      return '/admin'
    case 'student':
    default:
      // Campaign is the single student home; /plan is retired.
      return '/campaign'
  }
}
