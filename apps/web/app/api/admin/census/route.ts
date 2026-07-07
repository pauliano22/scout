// GET /api/admin/census — cohort coverage report for the admin dashboard.
// Auth: requireAdmin() enforced server-side (the admin layout check is client-only).

import { NextResponse } from 'next/server'
import { ApiAuthError, requireAdmin } from '@/lib/auth'
import { serviceClient } from '@/lib/requestAuth'

export async function GET() {
  try {
    await requireAdmin()
  } catch (e) {
    const status = e instanceof ApiAuthError ? e.status : 401
    return NextResponse.json({ error: 'Unauthorized' }, { status })
  }

  const supabase = serviceClient()

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
