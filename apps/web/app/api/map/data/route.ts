import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Pre-baked by the alumni-map pipeline (apps/map/scripts/build-data.mjs),
// which writes a copy to apps/web/data/alumni-map.json. Auth-gated so the
// full directory never sits on the open internet.

let cached: string | null = null

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!cached) {
    cached = await readFile(path.join(process.cwd(), 'data', 'alumni-map.json'), 'utf8')
  }
  return new NextResponse(cached, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
