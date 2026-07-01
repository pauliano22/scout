// POST /api/cron/request-testimonials — finds alumni whose first connection
// was 28-35 days ago and who haven't been asked for a testimonial yet.
// CRON_SECRET-protected. Recommended schedule: daily (0 12 * * *)
import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/requestAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.headers.get('x-cron-secret') === secret
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()

  try {
    const thirtyFiveDaysAgo = new Date()
    thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35)

    const twentyEightDaysAgo = new Date()
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28)

    // Raw SQL query to find alumni with a first connection between 28-35 days ago
    // who haven't received a testimonial request yet.
    const { data: result, error: queryError } = await db.rpc('get_eligible_testimonial_alumni', {
      since: thirtyFiveDaysAgo.toISOString(),
      until: twentyEightDaysAgo.toISOString(),
    })

    let eligibleIds: string[] = []

    if (queryError) {
      // Fallback: use a two-step approach
      // 1. Get alumni IDs with connections in the time window
      const { data: recentConnections, error: connError } = await db
        .from('user_networks')
        .select('alumni_id, created_at')
        .gte('created_at', thirtyFiveDaysAgo.toISOString())
        .lte('created_at', twentyEightDaysAgo.toISOString())
        .order('alumni_id')

      if (connError) throw connError

      if (!recentConnections || recentConnections.length === 0) {
        return NextResponse.json({ requests_created: 0, message: 'No eligible alumni found' })
      }

      // Deduplicate — take the earliest connection per alumni
      const earliestByAlumni = new Map<string, string>()
      for (const conn of recentConnections) {
        const existing = earliestByAlumni.get(conn.alumni_id)
        if (!existing || conn.created_at < existing) {
          earliestByAlumni.set(conn.alumni_id, conn.created_at)
        }
      }

      const candidateIds = Array.from(earliestByAlumni.keys())

      // 2. Filter out those already asked
      const { data: existingRequests, error: reqError } = await db
        .from('testimonial_requests')
        .select('alumni_id')
        .in('alumni_id', candidateIds)

      if (reqError) throw reqError

      const askedSet = new Set(existingRequests?.map((r) => r.alumni_id) ?? [])
      eligibleIds = candidateIds.filter((id) => !askedSet.has(id))
    } else {
      eligibleIds = (result ?? []).map((r: { id: string }) => r.id)
    }

    if (eligibleIds.length === 0) {
      return NextResponse.json({ requests_created: 0, message: 'No eligible alumni found' })
    }

    const requests = eligibleIds.map((alumni_id: string) => ({
      alumni_id,
      sent_at: new Date().toISOString(),
    }))

    const { error: insertError } = await db
      .from('testimonial_requests')
      .insert(requests)

    if (insertError) throw insertError

    return NextResponse.json({ requests_created: requests.length })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
