import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/requestAuth'
import { linkedinSlug, findAlumniByLinkedInSlug } from '@/lib/alumni/linkedin'

// ────────────────────────────────────────────────────────────────────────────
// POST /api/profile/linkedin-import
//
// Accepts { linkedin_url: string } and returns the career data Scout already
// has on file for that profile (work_history, education, company, role,
// location) for the user to review and confirm.
//
// This used to return MOCK data (a fabricated company/role hashed from the
// URL slug) behind a "we found the following information" banner. Now it
// looks the URL up in our own enriched alumni directory, which is real data,
// and says so honestly when we have nothing.
//
// Ownership: we only return a row that is the caller's own (linked via
// profiles.alumni_id or claimed_by_user_id) or still unclaimed. A row claimed
// by a different account is never returned, so this can't be used to fish
// other members' data past the directory gate.
// ────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const linkedinUrl: string | undefined = body.linkedin_url

    if (!linkedinUrl || typeof linkedinUrl !== 'string') {
      return NextResponse.json(
        { error: 'linkedin_url is required' },
        { status: 400 },
      )
    }

    const slug = linkedinSlug(linkedinUrl.trim())
    if (!slug) {
      return NextResponse.json(
        { error: 'That does not look like a LinkedIn profile URL. It should be like https://linkedin.com/in/yourname' },
        { status: 400 },
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('alumni_id')
      .eq('id', user.id)
      .single()

    // Look the slug up in our enriched directory. Service client: the
    // caller's own scraped row may predate their claim, and RLS would hide
    // it. Ownership is enforced below instead.
    const db = serviceClient()
    const matches = await findAlumniByLinkedInSlug(db, slug)

    const own = matches.find(
      (r) => r.id === profile?.alumni_id || r.claimed_by_user_id === user.id,
    )
    const claimable = matches.find((r) => !r.claimed_by_user_id)
    const row = own ?? claimable

    if (!row) {
      if (matches.length > 0) {
        return NextResponse.json(
          { error: 'That LinkedIn profile is already linked to another Scout account.' },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: "We don't have career data for that profile yet. You can add your details in the edit form and they'll show the same way." },
        { status: 404 },
      )
    }

    const workHistory = Array.isArray(row.work_history) ? row.work_history : []
    const education = Array.isArray(row.education) ? row.education : []
    if (!row.company && !row.role && workHistory.length === 0) {
      return NextResponse.json(
        { error: "We found your profile but don't have career data on file yet. You can add your details in the edit form." },
        { status: 404 },
      )
    }

    // Save the linkedin_url on the caller's own alumni record right away so
    // it sticks even if they don't apply the rest. Service client: RLS on
    // alumni is SELECT-only, so a cookie-client update silently writes
    // nothing.
    if (profile?.alumni_id) {
      await db
        .from('alumni')
        .update({ linkedin_url: linkedinUrl.trim() })
        .eq('id', profile.alumni_id)
    }

    return NextResponse.json({
      success: true,
      linkedin_url: linkedinUrl.trim(),
      parsed: {
        company: row.company ?? '',
        role: row.role ?? '',
        location: row.location ?? '',
        work_history: workHistory,
        education,
      },
    })
  } catch (err) {
    console.error('LinkedIn import error:', err)
    return NextResponse.json(
      { error: 'Failed to import LinkedIn profile' },
      { status: 500 },
    )
  }
}
