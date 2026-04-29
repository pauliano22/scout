import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Promote specific fields from the saved `resume_parsed` JSON into top-level
 * profile columns, overwriting any existing values. Used when a student
 * re-uploads a resume and explicitly confirms they want to refresh their
 * profile with the newer info.
 *
 * Body: { fields: string[] }  — subset of OVERWRITABLE_FIELDS
 * Only non-blank parsed values are written; null values never blank a column.
 */
const OVERWRITABLE_FIELDS = new Set([
  'major',
  'past_experience',
  'primary_industry',
  'graduation_year',
  'target_roles',
])

const isBlank = (v: unknown) =>
  v === null || v === undefined || v === '' ||
  (Array.isArray(v) && v.length === 0)

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const requested: string[] = Array.isArray(body.fields) ? body.fields : []
    const fields = requested.filter((f) => OVERWRITABLE_FIELDS.has(f))

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to apply' }, { status: 400 })
    }

    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('resume_parsed')
      .eq('id', user.id)
      .single()

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const parsed = (profile.resume_parsed ?? {}) as Record<string, unknown>
    const updates: Record<string, unknown> = {}

    for (const f of fields) {
      const value = parsed[f]
      if (isBlank(value)) continue
      updates[f] = value
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Resume has no values for the requested fields' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (updateError) {
      console.error('Resume apply update error:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, applied: Object.keys(updates) })
  } catch (err) {
    console.error('Resume apply error:', err)
    return NextResponse.json({ error: 'Failed to apply resume updates' }, { status: 500 })
  }
}
