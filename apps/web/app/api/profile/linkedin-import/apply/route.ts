import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  WorkHistoryEntry,
  EducationEntry,
} from '@scout/shared/types/database'

// ────────────────────────────────────────────────────────────────────────────
// POST /api/profile/linkedin-import/apply
//
// Applies confirmed LinkedIn import data to the alumni record. Accepts the
// fields returned by the linkedin-import endpoint and writes them to the
// alumni row associated with the authenticated user.
// ────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      linkedin_url,
      company,
      role,
      location,
      work_history,
      education,
    }: {
      linkedin_url?: string
      company?: string | null
      role?: string | null
      location?: string | null
      work_history?: WorkHistoryEntry[] | null
      education?: EducationEntry[] | null
    } = body

    if (!linkedin_url && !company && !role && !location && !work_history && !education) {
      return NextResponse.json(
        { error: 'No data provided to apply' },
        { status: 400 },
      )
    }

    // Fetch the current profile to get alumni_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('alumni_id, company, role, location')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.alumni_id) {
      return NextResponse.json(
        { error: 'Alumni profile not found. Please claim your profile first.' },
        { status: 404 },
      )
    }

    // Build update payload — only include non-null values
    const updates: Record<string, unknown> = {}
    if (company !== undefined && company !== null) updates.company = company
    if (role !== undefined && role !== null) updates.role = role
    if (location !== undefined && location !== null) updates.location = location
    if (work_history !== undefined) updates.work_history = work_history
    if (education !== undefined) updates.education = education
    if (linkedin_url !== undefined) updates.linkedin_url = linkedin_url

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 },
      )
    }

    const { error: updateError } = await supabase
      .from('alumni')
      .update(updates)
      .eq('id', profile.alumni_id)

    if (updateError) {
      console.error('LinkedIn apply update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      applied: Object.keys(updates),
    })
  } catch (err) {
    console.error('LinkedIn apply error:', err)
    return NextResponse.json(
      { error: 'Failed to apply LinkedIn data' },
      { status: 500 },
    )
  }
}
