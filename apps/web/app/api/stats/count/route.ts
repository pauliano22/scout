import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/requestAuth'

// Public aggregate — safe to cache, but cached at the CDN rather than with
// `export const revalidate`. Route-segment revalidation would let Next treat
// this handler as statically generated, which moves the Supabase call to BUILD
// time: the build would then depend on the database being reachable and on the
// service-role key being present in the build environment, and a transient
// failure there breaks the deploy rather than one request. Staying dynamic and
// letting the CDN hold the response for 5 minutes gets the same protection —
// at most one count per region per 5 minutes — with no build-time coupling.
export const dynamic = 'force-dynamic'

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600'

export async function GET() {
  try {
    // Public aggregate for the logged-out landing page — must not depend on
    // the caller's session. Migration 052 RLS returns zero alumni rows to
    // anonymous/unapproved sessions, so a cookie client here counts 0.
    const supabase = serviceClient()

    // Count over `id`, never `*`. PostgREST plans an exact count across every
    // column in the select list, and `alumni.embedding` is a vector(1536) that
    // serialises to ~19KB per row — counting with `*` dragged the whole 330MB
    // column through the planner and blew the statement timeout (~8.8s, HTTP
    // 500 on the public landing page). Counting `id` alone is ~3x faster and
    // actually completes.
    const { count, error } = await supabase
      .from('alumni')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true)

    if (error) {
      console.error('Failed to count alumni:', error)
      return NextResponse.json({ error: 'Failed to count alumni' }, { status: 500 })
    }

    return NextResponse.json({ count: count ?? 0 }, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    })
  } catch (err) {
    console.error('Unexpected error counting alumni:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
