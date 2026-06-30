import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiAuthError, requireUser } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import type { JobApplication } from '@scout/shared/types/database'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireUser()
    const supabase = createClient()

    const { data: job, error: jobErr } = await supabase
      .from('job_listings').select('id, is_active').eq('id', params.id).single()
    if (jobErr || !job) return fail('Job not found', 404)
    if (!job.is_active) return fail('This job is no longer accepting applications', 400)

    const { data: existing } = await supabase
      .from('job_applications').select('id')
      .eq('job_listing_id', params.id).eq('applicant_id', ctx.userId)
      .maybeSingle()
    if (existing) return fail('You have already applied to this job', 409)

    const body = await req.json()
    const insert = {
      job_listing_id: params.id,
      applicant_id: ctx.userId,
      cover_note: body.cover_note ?? null,
      resume_url: body.resume_url ?? null,
      status: 'pending',
    }

    const { data, error } = await supabase.from('job_applications').insert(insert).select('*').single()
    if (error) return fail(error.message, 400)
    return ok<JobApplication>(data as JobApplication, 201)
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
