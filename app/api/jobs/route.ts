import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { JobFilters } from '@/types/database'

// GET: List/search jobs with filters
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)

    // Parse filters from query params
    const filters: JobFilters = {
      search: searchParams.get('search') || undefined,
      industry: searchParams.get('industry') || undefined,
      location: searchParams.get('location') || undefined,
      job_type: searchParams.get('job_type') as JobFilters['job_type'] || undefined,
      seniority_level: searchParams.get('seniority_level') || undefined,
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters.industry) {
      query = query.eq('industry', filters.industry)
    }

    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`)
    }

    if (filters.job_type) {
      query = query.eq('job_type', filters.job_type)
    }

    if (filters.seniority_level) {
      query = query.eq('seniority_level', filters.seniority_level)
    }

    if (filters.search) {
      // Search across title, company, and description
      query = query.or(
        `title.ilike.%${filters.search}%,company.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      )
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: jobs, error, count } = await query

    if (error) {
      console.error('Error fetching jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    return NextResponse.json({
      jobs: jobs || [],
      total: count || 0,
      page,
      limit,
      hasMore: (count || 0) > offset + limit,
    })
  } catch (error) {
    console.error('Jobs API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
