import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { full_name, email, sport, graduation_year, company, role, industry, location, linkedin_url } = body

    // Validate required fields
    if (!full_name || !sport || !graduation_year) {
      return NextResponse.json(
        { error: 'Name, sport, and graduation year are required.' },
        { status: 400 }
      )
    }

    // Validate graduation year is a number
    const gradYear = parseInt(graduation_year)
    if (isNaN(gradYear) || gradYear < 1900 || gradYear > 2040) {
      return NextResponse.json(
        { error: 'Invalid graduation year.' },
        { status: 400 }
      )
    }

    // Use service role key to bypass RLS for public submissions
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const alumniData = {
      full_name,
      email: email || null,
      sport,
      graduation_year: gradYear,
      company: company || null,
      role: role || null,
      industry: industry || null,
      location: location || null,
      linkedin_url: linkedin_url || null,
      source: 'opt_in',
      is_public: true,
      is_verified: false,
    }

    // If email provided, check for duplicates
    if (email) {
      const { data: existing } = await supabase
        .from('alumni')
        .select('id')
        .eq('email', email)
        .single()

      if (existing) {
        // Update existing entry
        const { error } = await supabase
          .from('alumni')
          .update(alumniData)
          .eq('id', existing.id)

        if (error) throw error

        return NextResponse.json({ success: true, updated: true })
      }
    }

    // Insert new alumni
    const { error } = await supabase
      .from('alumni')
      .insert(alumniData)

    if (error) throw error

    return NextResponse.json({ success: true, updated: false })
  } catch (error: any) {
    console.error('Alumni submit error:', error)
    return NextResponse.json(
      { error: 'Failed to submit. Please try again.' },
      { status: 500 }
    )
  }
}
