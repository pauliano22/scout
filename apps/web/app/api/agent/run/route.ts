import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runScoutNetworkingAgent } from '@/lib/agent/runScoutNetworkingAgent'
import type { AgentAlumni, AgentInput } from '@/lib/agent/types'
import { sanitizeAlumniForStudent } from '@/lib/privacy/sanitizeAlumni'

export const dynamic = 'force-dynamic'

// Cap the candidate pool so a single request never scans the whole table.
// Matches the mobile two-pass cap (Pass-2 limit 500 in fetchRecommendations).
const POOL_CAP = 500

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { input?: Omit<AgentInput, 'goalDomain'> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.input) {
    return NextResponse.json({ error: 'Missing `input`' }, { status: 400 })
  }

  // Pull a real alumni pool. AgentAlumni is a strict subset of the alumni row;
  // we only select what the agent needs. Constrain to public + has-some-career-info
  // so the agent never recommends nearly-empty rows.
  const { data: rows, error } = await supabase
    .from('alumni')
    .select('id, full_name, sport, graduation_year, company, role, industry, location, linkedin_url, is_claimed, share_email_with_students')
    .eq('is_public', true)
    .or('company.not.is.null,role.not.is.null')
    .order('updated_at', { ascending: false })
    .limit(POOL_CAP)

  if (error) {
    console.error('Agent run: alumni fetch error', error)
    return NextResponse.json({ error: 'Failed to load alumni pool' }, { status: 500 })
  }

  // Consent gate: the agent result (including these rows) goes back to the
  // student, so strip non-consented contact info before it enters the pool.
  const pool: AgentAlumni[] = (rows ?? []).map(sanitizeAlumniForStudent).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    sport: r.sport ?? '',
    graduation_year: r.graduation_year,
    company: r.company,
    role: r.role,
    industry: r.industry,
    location: r.location,
    linkedin_url: r.linkedin_url,
  }))

  try {
    const result = runScoutNetworkingAgent(body.input, pool)
    return NextResponse.json({ result })
  } catch (err) {
    console.error('Agent run: agent execution error', err)
    return NextResponse.json({ error: 'Agent run failed' }, { status: 500 })
  }
}
