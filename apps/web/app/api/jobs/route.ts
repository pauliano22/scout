import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiAuthError, requireAlumniOrAdmin, requireUser } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import type { JobListing, EmploymentType } from '@scout/shared/types/database'

const EMPLOYMENT_TYPES: EmploymentType[] = ['full-time', 'part-time', 'contract', 'internship', 'temporary']

export async function GET(request: NextRequest) {
  try {
    await requireUser()
    const params = request.nextUrl.searchParams
    const sport = params.get('sport')
    const employmentType = params.get('employment_type') as EmploymentType | null
    const location = params.get('location')
    const search = params.get('search')
    const activeOnly = params.get('active') !== 'false'
    const limit = Math.min(Number(params.get('limit') ?? 50), 200)
    const offset = Math.max(Number(params.get('offset') ?? 0), 0)

    const supabase = createClient()
    let query = supabase
      .from('job_listings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    if (activeOnly) query = query.eq('is_active', true)
    if (employmentType && EMPLOYMENT_TYPES.includes(employmentType)) query = query.eq('employment_type', employmentType)
    if (location) query = query.ilike('location', `%${location}%`)
    if (sport) query = query.contains('sport_tags', [sport])
    if (search) query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%,description.ilike.%${search}%`)

    const { data, error, count } = await query
    if (error) return fail(error.message, 500)
    return ok<{ items: JobListing[]; total: number | null }>({ items: (data ?? []) as JobListing[], total: count })
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAlumniOrAdmin()
    const body = await request.json()
    const title = String(body.title ?? '').trim()
    const company = String(body.company ?? '').trim()

    if (!title) return fail('title is required')
    if (!company) return fail('company is required')

    const insert = {
      title,
      company,
      location: body.location ?? null,
      description: body.description ?? null,
      employment_type: EMPLOYMENT_TYPES.includes(body.employment_type) ? body.employment_type : null,
      salary_range: body.salary_range ?? null,
      application_url: body.application_url ?? null,
      posted_by: ctx.userId,
      sport_tags: Array.isArray(body.sport_tags) ? body.sport_tags : [],
      is_active: body.is_active !== false,
    }

    const supabase = createClient()
    const { data, error } = await supabase.from('job_listings').insert(insert).select('*').single()
    if (error) return fail(error.message, 400)
    return ok<JobListing>(data as JobListing, 201)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
