import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  WorkHistoryEntry,
  EducationEntry,
} from '@scout/shared/types/database'

// ────────────────────────────────────────────────────────────────────────────
// POST /api/profile/linkedin-import
//
// Accepts { linkedin_url: string }, authenticates the user, and returns
// parsed LinkedIn profile data (work_history, education, company, role,
// location) for the user to review and confirm.
//
// TODO: Replace the mock data below with real LinkedIn scraping or a call
//       to a third-party API (e.g., Proxycurl, Scrapin, or a headless
//       browser / Puppeteer solution) once credentials are configured.
// ────────────────────────────────────────────────────────────────────────────

function mockLinkedInScrape(url: string): {
  company: string
  role: string
  location: string
  work_history: WorkHistoryEntry[]
  education: EducationEntry[]
} {
  // Extract a username-like slug from the URL for demo variety
  const slug = url.replace(/https?:\/\//, '').replace(/\/$/, '').split('/').pop() || 'user'

  // Deterministic "mock" that varies per slug so the UI feels real
  const hash = slug.length + slug.charCodeAt(0)

  const companies = ['Goldman Sachs', 'McKinsey & Company', 'Google', 'Apple', 'Amazon', 'J.P. Morgan', 'Deloitte', 'Meta']
  const roles = ['Investment Banking Analyst', 'Management Consultant', 'Software Engineer', 'Product Manager', 'Data Scientist', 'Associate', 'Strategy Analyst']
  const locations = ['New York, NY', 'San Francisco, CA', 'Chicago, IL', 'Boston, MA', 'Seattle, WA', 'Miami, FL']

  const cIdx = hash % companies.length
  const rIdx = (hash + 2) % roles.length
  const lIdx = (hash + 5) % locations.length

  const title = roles[rIdx]
  const company = companies[cIdx]
  const location = locations[lIdx]

  const currentYear = new Date().getFullYear()

  const work_history: WorkHistoryEntry[] = [
    {
      title,
      company,
      start: { year: currentYear - 2, month: 6 },
      end: null,
      duration: '2 yrs',
      location,
    },
    {
      title: roles[(rIdx + 1) % roles.length],
      company: companies[(cIdx + 1) % companies.length],
      start: { year: currentYear - 5, month: 1 },
      end: { year: currentYear - 2, month: 6 },
      duration: '3 yrs',
      location: locations[(lIdx + 2) % locations.length],
    },
  ]

  const education: EducationEntry[] = [
    {
      school: 'Cornell University',
      degree: "Bachelor's Degree",
      field: 'Economics',
      start: currentYear - 8,
      end: currentYear - 4,
    },
  ]

  return { company, role: title, location, work_history, education }
}

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

    // Basic LinkedIn URL validation
    const linkedinPattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/
    if (!linkedinPattern.test(linkedinUrl.trim())) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn profile URL. Must be like https://linkedin.com/in/username' },
        { status: 400 },
      )
    }

    // ── TODO: Replace mock with real LinkedIn scraping / API integration ──
    // Use a service like Proxycurl, Scrapin, or a headless browser to
    // fetch the actual profile data from LinkedIn.
    const parsed = mockLinkedInScrape(linkedinUrl.trim())

    // Save the linkedin_url on the alumni record immediately so it's stored
    // even if the user doesn't apply the full import right now.
    const { data: profile } = await supabase
      .from('profiles')
      .select('alumni_id')
      .eq('id', user.id)
      .single()

    if (profile?.alumni_id) {
      await supabase
        .from('alumni')
        .update({ linkedin_url: linkedinUrl.trim() })
        .eq('id', profile.alumni_id)
    }

    return NextResponse.json({
      success: true,
      linkedin_url: linkedinUrl.trim(),
      parsed,
    })
  } catch (err) {
    console.error('LinkedIn import error:', err)
    return NextResponse.json(
      { error: 'Failed to import LinkedIn profile' },
      { status: 500 },
    )
  }
}
