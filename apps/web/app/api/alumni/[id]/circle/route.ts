// GET /api/alumni/[id]/circle — the "Cornell circle" for one alum: teammates
// with seasons-together, on-campus-era counts, and warm paths through the
// calling student's saved network ("John, already in your network, played with
// this alum for 3 seasons — ask him for the intro").
//
// Auth: accepts the web cookie session OR a mobile Bearer token (same pattern
// as /api/network/[id]). Data comes from the pre-baked alumni-map dataset.

import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/requestAuth'
import { buildCircle } from '@/lib/alumni-circle'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await resolveRequestUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { userId, db } = auth

  const limitParam = Number(request.nextUrl.searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, Math.round(limitParam))) : 12

  // The caller's saved network, for warm-path intersection.
  const { data: network } = await db
    .from('user_networks')
    .select('alumni_id, status')
    .eq('user_id', userId)

  const saved = (network ?? [])
    .filter(n => !['proposed', 'not_interested'].includes((n.status as string) ?? ''))
    .map(n => ({ alumniId: n.alumni_id as string, status: (n.status as string) ?? null }))

  try {
    const circle = await buildCircle(params.id, saved, limit)
    if (!circle) return NextResponse.json({ error: 'Unknown alumni id' }, { status: 404 })
    return NextResponse.json(circle, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (e: any) {
    console.error('[alumni/circle]', e?.message ?? e)
    return NextResponse.json({ error: 'Failed to build circle' }, { status: 500 })
  }
}
