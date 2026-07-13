import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSuppressionSets, isSuppressed } from '@/lib/alumni/suppression'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { full_name, email, sport, graduation_year, company, role, industry, location, linkedin_url } = body

    if (!full_name || !sport || !graduation_year) {
      return NextResponse.json(
        { error: 'Name, sport, and graduation year are required.' },
        { status: 400 }
      )
    }

    const gradYear = parseInt(graduation_year)
    if (isNaN(gradYear) || gradYear < 1960 || gradYear > 2040) {
      return NextResponse.json(
        { error: 'Please enter a valid graduation year.' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // People hard-deleted via /admin/removals are suppressed from all import
    // paths — including this unauthenticated opt-in form, which anyone could
    // otherwise use to resurrect a deleted profile. A genuine re-opt-in needs
    // an admin to remove the suppression row first.
    const suppression = await getSuppressionSets(supabase)
    if (isSuppressed(suppression, { email: email?.trim() || null, linkedin_url: linkedin_url || null })) {
      console.warn('[alumni/submit] blocked submission matching suppression list')
      return NextResponse.json({ success: true, claimed: false })
    }

    const alumniData = {
      full_name: full_name.trim(),
      email: email?.trim() || null,
      sport,
      graduation_year: gradYear,
      company: company || null,
      role: role || null,
      industry: industry || null,
      location: location || null,
      linkedin_url: linkedin_url || null,
      source: 'opt_in',
      is_public: true,
      is_verified: true,
    }

    // 1. Match by email (highest confidence)
    if (email?.trim()) {
      const { data: emailMatch } = await supabase
        .from('alumni')
        .select('id')
        .eq('email', email.trim())
        .single()

      if (emailMatch) {
        await supabase.from('alumni').update(alumniData).eq('id', emailMatch.id)
        return NextResponse.json({ success: true, claimed: true })
      }
    }

    // 2. Match by name + sport + graduation year (claims existing scraped profile)
    const { data: nameMatch } = await supabase
      .from('alumni')
      .select('id')
      .ilike('full_name', full_name.trim())
      .eq('graduation_year', gradYear)
      .eq('sport', sport)
      .single()

    if (nameMatch) {
      await supabase.from('alumni').update(alumniData).eq('id', nameMatch.id)
      return NextResponse.json({ success: true, claimed: true })
    }

    // 3. Match by name + graduation year (looser — catches sport name variations)
    const { data: nameYearMatch } = await supabase
      .from('alumni')
      .select('id')
      .ilike('full_name', full_name.trim())
      .eq('graduation_year', gradYear)
      .single()

    if (nameYearMatch) {
      await supabase.from('alumni').update(alumniData).eq('id', nameYearMatch.id)
      return NextResponse.json({ success: true, claimed: true })
    }

    // 4. No match — insert as new opt-in alumni
    const { error } = await supabase.from('alumni').insert(alumniData)
    if (error) throw error

    return NextResponse.json({ success: true, claimed: false })
  } catch (error: any) {
    console.error('Alumni submit error:', error)
    return NextResponse.json(
      { error: 'Failed to submit. Please try again.' },
      { status: 500 }
    )
  }
}
