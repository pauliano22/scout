// GET /api/sports/normalized — Returns all canonical sports with alias counts
// and basic metadata. Publicly readable.

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: sports, error } = await sb
    .from('sport_normalization')
    .select('*')
    .order('canonical_name', { ascending: true })

  if (error) {
    console.error('[sports/normalized] query failed:', error.message)
    return NextResponse.json({ data: null, error: error.message }, { status: 500 })
  }

  const result = (sports ?? []).map((s: Record<string, unknown>) => ({
    canonicalName: s.canonical_name,
    aliasCount: Array.isArray(s.aliases) ? (s.aliases as string[]).length : 0,
    aliases: s.aliases,
    category: s.category,
    contactType: s.contact_type,
    level: s.level,
  }))

  return NextResponse.json({ data: result, error: null })
}
