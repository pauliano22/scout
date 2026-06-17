import { NextRequest } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'
import { ok, fail } from '@/lib/api/respond'

export async function GET(_request: NextRequest) {
  try {
    await requireAdmin()
    const db = serviceClient()

    const [{ count: totalUsers }, { count: totalAlumni }, { count: verifiedUsers }, { data: recentSignups }] =
      await Promise.all([
        db.from('profiles').select('*', { count: 'exact', head: true }),
        db.from('profiles').select('*', { count: 'exact', head: true }).eq('is_alumni', true),
        db.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        db
          .from('profiles')
          .select('id, full_name, email, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

    // Flagged content count — table may not exist yet, so fallback gracefully
    let flaggedContent = 0
    try {
      const { count } = await db
        .from('reported_content')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'flagged')
      flaggedContent = count ?? 0
    } catch {
      // reported_content table doesn't exist yet
    }

    return ok({
      totalUsers: totalUsers ?? 0,
      totalAlumni: totalAlumni ?? 0,
      verifiedUsers: verifiedUsers ?? 0,
      flaggedContent,
      recentSignups: recentSignups ?? [],
    })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    if (e instanceof Error) return fail(e.message, 400)
    return fail('Internal error', 500)
  }
}
