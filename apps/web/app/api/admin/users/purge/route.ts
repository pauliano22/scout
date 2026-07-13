// POST /api/admin/users/purge — institutional data purge (DPA §8).
//
// Admin-only. Accepts { user_id } or { email } plus dry_run. Deletes the auth
// user (profiles/user_networks/plan_alumni cascade — same mechanism as the
// self-serve /api/profile/delete) AND the email-keyed survivor tables that a
// cascade never reaches: password_reset_tokens, password_reset_audit_log,
// abandoned_registrations, plus user_id-keyed rows that would otherwise be
// SET NULL (signup_events, security_events). Works for email-only targets too
// (e.g. an abandoned registration that never became an auth user).
//
// Returns a written confirmation JSON with per-table removal counts — this is
// the artifact sent to the institution as the §8 deletion confirmation.
// dry_run: true counts everything and deletes nothing.

import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'
import { logSecurityEvent, currentRequestIp } from '@/lib/security/events'

export const dynamic = 'force-dynamic'

const EMAIL_KEYED_TABLES = [
  'password_reset_tokens',
  'password_reset_audit_log',
  'abandoned_registrations',
] as const

const USER_KEYED_TABLES = [
  'user_preferences',
  'user_networks',
  'signup_events',
  'security_events',
] as const

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdmin()
    const db = serviceClient()

    let body: { user_id?: string; email?: string; dry_run?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      return fail('Invalid JSON body', 400)
    }

    const dryRun = body.dry_run === true
    const inputUserId = (body.user_id ?? '').trim() || null
    const inputEmail = (body.email ?? '').trim().toLowerCase() || null
    if (!inputUserId && !inputEmail) return fail('Provide user_id or email', 400)

    // ── Resolve the target ──────────────────────────────────────────────
    let userId = inputUserId
    let email = inputEmail

    if (userId) {
      const { data: profile } = await db
        .from('profiles')
        .select('id, email')
        .eq('id', userId)
        .maybeSingle()
      if (!email) email = (profile?.email as string | null)?.toLowerCase() ?? null
      if (!email) {
        const { data: authUser } = await db.auth.admin.getUserById(userId)
        email = authUser?.user?.email?.toLowerCase() ?? null
      }
    } else if (email) {
      const { data: profile } = await db
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle()
      userId = (profile?.id as string | null) ?? null
    }

    // Confirm there really is an auth user before we claim to delete one.
    let hasAuthUser = false
    if (userId) {
      const { data: authUser } = await db.auth.admin.getUserById(userId)
      hasAuthUser = Boolean(authUser?.user)
    }

    if (!hasAuthUser && !email) {
      return fail('No matching auth user or email-keyed records to purge', 404)
    }

    // ── Count / delete per table ────────────────────────────────────────
    const removed: Record<string, number> = {}

    const countRows = async (table: string, column: string, value: string) => {
      const q = db.from(table).select('id', { count: 'exact', head: true })
      const { count } = column === 'email' ? await q.ilike(column, value) : await q.eq(column, value)
      return count ?? 0
    }
    const deleteRows = async (table: string, column: string, value: string) => {
      const q = db.from(table).delete({ count: 'exact' })
      const { count, error } = column === 'email' ? await q.ilike(column, value) : await q.eq(column, value)
      if (error) throw new Error(`${table}: ${error.message}`)
      return count ?? 0
    }

    if (userId) {
      // profiles cascades from auth.users, but count it for the confirmation.
      removed.profiles = await countRows('profiles', 'id', userId)
      for (const table of USER_KEYED_TABLES) {
        removed[table] = dryRun
          ? await countRows(table, 'user_id', userId)
          : await deleteRows(table, 'user_id', userId)
      }

      // Avatar storage files (same pattern as /api/profile/delete).
      const { data: avatarFiles } = await db.storage.from('user-avatars').list(userId)
      removed.avatar_files = avatarFiles?.length ?? 0
      if (!dryRun && avatarFiles && avatarFiles.length > 0) {
        await db.storage.from('user-avatars').remove(avatarFiles.map((f) => `${userId}/${f.name}`))
      }
    }

    if (email) {
      for (const table of EMAIL_KEYED_TABLES) {
        removed[table] = dryRun
          ? await countRows(table, 'email', email)
          : await deleteRows(table, 'email', email)
      }
    }

    removed.auth_user = hasAuthUser ? 1 : 0
    if (hasAuthUser && userId && !dryRun) {
      const { error: deleteError } = await db.auth.admin.deleteUser(userId)
      if (deleteError) throw new Error(`auth user: ${deleteError.message}`)
    }

    if (!dryRun) {
      logSecurityEvent({
        event_type: 'admin_user_purge',
        severity: 'info',
        source_ip: currentRequestIp(),
        user_id: ctx.userId,
        details: { purged_user_id: userId, had_auth_user: hasAuthUser, removed },
      })
    }

    // Written deletion confirmation (DPA §8) — per-table counts.
    return ok({
      dry_run: dryRun,
      target: { user_id: userId, email },
      removed,
      note: userId
        ? 'profiles, user_networks and plan rows are removed via ON DELETE CASCADE when the auth user is deleted; counts above reflect rows present at purge time.'
        : 'No auth user matched — only email-keyed records were purged.',
      completed_at: new Date().toISOString(),
      confirmation: dryRun
        ? 'DRY RUN — no data was deleted.'
        : `Scout confirms permanent deletion of all personal data held for ${email ?? userId} as itemized above.`,
    })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    console.error('[admin/users/purge] error:', e)
    return fail(e instanceof Error ? e.message : 'Internal error', 500)
  }
}
