import { createClient } from '@/lib/supabase/server'
import { logSecurityEvent, currentRequestIp } from '@/lib/security/events'
import type { UserRole, TeamCode } from '@scout/shared/types/database'

export type AuthContext = {
  userId: string
  role: UserRole
  team: TeamCode | null
  isAdmin: boolean
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_role, team, is_admin')
    .eq('id', user.id)
    .single()

  if (!profile) return null
  return {
    userId: user.id,
    role: profile.account_role as UserRole,
    team: (profile.team as TeamCode | null) ?? null,
    isAdmin: Boolean(profile.is_admin),
  }
}

export async function requireUser(): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx) throw new ApiAuthError('Unauthorized', 401)
  return ctx
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx) {
    logSecurityEvent({
      event_type: 'auth_failure',
      severity: 'warning',
      source_ip: currentRequestIp(),
      details: { gate: 'admin', reason: 'unauthenticated' },
    })
    throw new ApiAuthError('Unauthorized', 401)
  }
  if (!ctx.isAdmin) {
    logSecurityEvent({
      event_type: 'auth_failure',
      severity: 'warning',
      source_ip: currentRequestIp(),
      user_id: ctx.userId,
      details: { gate: 'admin', reason: 'not_admin' },
    })
    throw new ApiAuthError('Forbidden', 403)
  }
  return ctx
}

export async function requireAlumniOrAdmin(): Promise<AuthContext> {
  const ctx = await requireUser()
  if (ctx.role !== 'alumni' && ctx.role !== 'admin') {
    throw new ApiAuthError('Forbidden', 403)
  }
  return ctx
}

export class ApiAuthError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}
