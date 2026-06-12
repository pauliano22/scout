// POST /api/alumni/warm-paths { alumniIds: string[] } — batch warm-path lookup
// for recommendation surfaces (Discover deck, campaign proposed shelf). For
// each candidate, returns whether someone in the caller's saved network was on
// campus with them, and who the best introducer is. Cookie or Bearer auth.

import { NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { warmPathsFor } from '@/lib/alumni-circle'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { alumniIds?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const ids = Array.isArray(body.alumniIds)
    ? body.alumniIds.filter((x): x is string => typeof x === 'string').slice(0, 200)
    : []
  if (!ids.length) return NextResponse.json({ paths: {} })

  const { data: network } = await auth.db
    .from('user_networks')
    .select('alumni_id, status')
    .eq('user_id', auth.userId)
  const saved = (network ?? [])
    .filter(n => !['proposed', 'not_interested'].includes((n.status as string) ?? ''))
    .map(n => ({ alumniId: n.alumni_id as string, status: (n.status as string) ?? null }))

  try {
    const paths = await warmPathsFor(ids, saved)
    return NextResponse.json({ paths })
  } catch (e: any) {
    console.error('[alumni/warm-paths]', e?.message ?? e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
