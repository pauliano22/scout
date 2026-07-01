import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data } = await supabase
    .from('census_reports')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1000)

  if (!data) {
    return NextResponse.json({ reports: [], summary: { total: 0, critical: 0, growing: 0, healthy: 0, avgCoverage: 0 } })
  }

  const summary = {
    total: data.length,
    critical: data.filter(r => r.gap_category === 'critical').length,
    growing: data.filter(r => r.gap_category === 'growing').length,
    healthy: data.filter(r => r.gap_category === 'healthy').length,
    avgCoverage: Math.round(data.reduce((s, r) => s + Number(r.coverage_pct), 0) / data.length * 100) / 100,
  }

  return NextResponse.json({ reports: data, summary })
}
