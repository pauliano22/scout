import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApiAuthError, requireUser } from '@/lib/auth'
import { fail, ok } from '@/lib/api/respond'
import type { JobApplication } from '@scout/shared/types/database'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const ctx = await requireUser()
    const supabase = createClient()

    const { data: job, error: jobErr } = await supabase
      .from('job_listings').select('posted_by').eq('id', params.id).single()
    if (jobErr || !job) return fail('Job not found', 404)
    if (!ctx.isAdmin && job.posted_by !== ctx.userId) return fail('Forbidden', 403)

    const { data, error } = await supabase
      .from('job_applications').select('*')
      .eq('job_listing_id', params.id)
      .order('created_at', { ascending: false })
    if (error) return fail(error.message, 500)
    return ok<JobApplication[]>((data ?? []) as JobApplication[])
  } catch (e) {
    if (e instanceof ApiAuthError) return fail(e.message, e.status)
    return fail('Internal error', 500)
  }
}
