import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/requestAuth'

// Pre-baked by the alumni-map pipeline (apps/map/scripts/build-data.mjs),
// which writes a copy to apps/web/data/alumni-map.json. Auth-gated so the
// full directory never sits on the open internet.
//
// The bake is static, so people who opted out (is_public=false) or were merged
// away (is_duplicate) since bake time are filtered live before serving — the
// filtered payload is re-cached with a TTL so a fresh opt-out disappears
// within an hour, not at next deploy.

let cached: { body: string; at: number } | null = null
const TTL_MS = 60 * 60 * 1000

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!cached || Date.now() - cached.at > TTL_MS) {
    const raw = await readFile(path.join(process.cwd(), 'data', 'alumni-map.json'), 'utf8')
    let body = raw
    try {
      const { data: hiddenRows } = await serviceClient()
        .from('alumni')
        .select('id')
        .or('is_public.eq.false,is_duplicate.eq.true')
        .limit(5000)
      const hidden = new Set((hiddenRows ?? []).map(r => r.id as string))
      if (hidden.size) {
        const data = JSON.parse(raw)
        data.alumni = data.alumni.filter((p: { id: string }) => !hidden.has(p.id))
        body = JSON.stringify(data)
      }
    } catch (e) {
      // Serving the unfiltered bake beats serving nothing.
      console.error('[map/data] live filter failed:', e instanceof Error ? e.message : e)
    }
    cached = { body, at: Date.now() }
  }
  return new NextResponse(cached.body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
