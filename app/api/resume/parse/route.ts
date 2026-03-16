import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { storagePath } = await request.json()
    if (!storagePath) return NextResponse.json({ error: 'Missing storagePath' }, { status: 400 })

    // Download the PDF using service role (bypasses RLS for server-side access)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: fileData, error: downloadError } = await serviceClient
      .storage
      .from('resumes')
      .download(storagePath)

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError)
      return NextResponse.json({ error: 'Failed to download resume' }, { status: 500 })
    }

    // Convert to base64 for Claude's document API
    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Send to Claude as a native PDF document
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract structured information from this resume. Return ONLY a JSON object with these exact fields (use null for anything not found):

{
  "full_name": string | null,
  "major": string | null,
  "graduation_year": number | null,
  "gpa": string | null,
  "target_roles": string[],
  "skills": string[],
  "past_experience": string,
  "primary_industry": string | null,
  "location": string | null
}

For "past_experience": write a 2-3 sentence plain English summary of their work history and internships.
For "primary_industry": pick the single best fit from: Finance, Technology, Consulting, Healthcare, Law, Media, Education, Real Estate, Non-Profit, Government, Sports, Other.
For "target_roles": list up to 3 roles based on their apparent career direction.
For "skills": list up to 8 hard skills (languages, tools, certifications).

Return only valid JSON, nothing else.`,
            },
          ],
        },
      ],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '{}'

    let parsed: Record<string, unknown>
    try {
      // Strip any markdown code fences if present
      const cleaned = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse Claude response:', rawText)
      return NextResponse.json({ error: 'Failed to parse resume content' }, { status: 500 })
    }

    // Update profile with extracted data — only fill fields that are currently empty
    const { data: profile } = await supabase
      .from('profiles')
      .select('major, past_experience, primary_industry, target_roles, graduation_year')
      .eq('id', user.id)
      .single()

    const updates: Record<string, unknown> = {
      resume_url: storagePath,
      resume_parsed: parsed,
    }

    // Only overwrite profile fields if they're blank
    if (!profile?.major && parsed.major) updates.major = parsed.major
    if (!profile?.past_experience && parsed.past_experience) updates.past_experience = parsed.past_experience
    if (!profile?.primary_industry && parsed.primary_industry) updates.primary_industry = parsed.primary_industry
    if (!profile?.graduation_year && parsed.graduation_year) updates.graduation_year = parsed.graduation_year
    if (
      (!profile?.target_roles || profile.target_roles.length === 0) &&
      Array.isArray(parsed.target_roles) &&
      (parsed.target_roles as string[]).length > 0
    ) {
      updates.target_roles = parsed.target_roles
    }

    const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (updateError) {
      console.error('Profile update error (resume):', updateError)
    }

    return NextResponse.json({ parsed })
  } catch (error) {
    console.error('Resume parse error:', error)
    return NextResponse.json({ error: 'Failed to process resume' }, { status: 500 })
  }
}
