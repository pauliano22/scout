import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const VALID_INDUSTRIES = [
  'Finance',
  'Technology',
  'Consulting',
  'Healthcare',
  'Law',
  'Media',
  'Sports',
  'Education',
  'Real Estate',
  'Government',
  'Nonprofit'
]

const BATCH_SIZE = 50 // Process 50 alumni at a time with Claude

async function classifyWithClaude(
  anthropic: Anthropic,
  alumni: { id: string; full_name: string; role: string | null; company: string | null }[]
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()

  // Build the prompt with all alumni in this batch
  const alumniList = alumni.map((a, i) =>
    `${i + 1}. Name: ${a.full_name}, Role: ${a.role || 'Unknown'}, Company: ${a.company || 'Unknown'}`
  ).join('\n')

  const prompt = `Classify each person into ONE of these industries based on their role and company. If you cannot determine the industry or there's not enough information, respond with "null".

Valid industries: ${VALID_INDUSTRIES.join(', ')}

People to classify:
${alumniList}

Respond with ONLY a JSON array of objects with "index" (1-based) and "industry" (one of the valid industries or null). Example:
[{"index": 1, "industry": "Finance"}, {"index": 2, "industry": null}, {"index": 3, "industry": "Technology"}]

Important rules:
- Teachers, professors, educators -> Education
- Software engineers, developers, tech companies (Google, Meta, etc.) -> Technology
- Bankers, investment analysts, financial advisors -> Finance
- Doctors, nurses, healthcare workers, pharma -> Healthcare
- Lawyers, attorneys, legal professionals -> Law
- Consultants at McKinsey, Bain, BCG, etc. -> Consulting
- Athletes, coaches, sports organizations -> Sports
- Journalists, entertainment, advertising -> Media
- Government workers, military, policy -> Government
- Nonprofit workers, NGOs, foundations -> Nonprofit
- Real estate agents, property managers -> Real Estate
- If role/company is missing or unclear -> null

Return ONLY the JSON array, no other text.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Parse the JSON response
    const classifications = JSON.parse(content.text)

    for (const item of classifications) {
      const alumniIndex = item.index - 1
      if (alumniIndex >= 0 && alumniIndex < alumni.length) {
        const industry = item.industry === 'null' || item.industry === null ? null : item.industry
        // Validate the industry is in our list
        if (industry === null || VALID_INDUSTRIES.includes(industry)) {
          results.set(alumni[alumniIndex].id, industry)
        } else {
          results.set(alumni[alumniIndex].id, null) // Invalid industry, set to null
        }
      }
    }
  } catch (error) {
    console.error('Claude classification error:', error)
    // On error, set all to null (don't make assumptions)
    for (const a of alumni) {
      results.set(a.id, null)
    }
  }

  return results
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const adminKey = searchParams.get('key')

    if (adminKey !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-10)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch all alumni
    const { data: alumni, error: fetchError } = await supabase
      .from('alumni')
      .select('id, full_name, role, company, industry')
      .limit(50000)

    if (fetchError) throw fetchError

    let updated = 0
    let cleared = 0
    let unchanged = 0
    const changes: { name: string; role: string | null; company: string | null; oldIndustry: string | null; newIndustry: string | null }[] = []

    // Process in batches
    for (let i = 0; i < (alumni?.length || 0); i += BATCH_SIZE) {
      const batch = alumni!.slice(i, i + BATCH_SIZE)

      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil((alumni?.length || 0) / BATCH_SIZE)}...`)

      const classifications = await classifyWithClaude(anthropic, batch)

      // Update each alumni in this batch
      for (const person of batch) {
        const newIndustry = classifications.get(person.id)

        if (newIndustry !== person.industry) {
          const { error: updateError } = await supabase
            .from('alumni')
            .update({ industry: newIndustry })
            .eq('id', person.id)

          if (updateError) {
            console.error(`Error updating ${person.full_name}:`, updateError)
            continue
          }

          changes.push({
            name: person.full_name,
            role: person.role,
            company: person.company,
            oldIndustry: person.industry,
            newIndustry: newIndustry ?? null
          })

          if (newIndustry === null) {
            cleared++
          } else {
            updated++
          }
        } else {
          unchanged++
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < (alumni?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return NextResponse.json({
      success: true,
      total: alumni?.length || 0,
      updated,
      cleared,
      unchanged,
      sampleChanges: changes.slice(0, 100)
    })

  } catch (error: any) {
    console.error('Fix industries error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fix industries' },
      { status: 500 }
    )
  }
}

// GET endpoint to preview changes without applying
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const adminKey = searchParams.get('key')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (adminKey !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-10)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch limited alumni for preview
    const { data: alumni, error: fetchError } = await supabase
      .from('alumni')
      .select('id, full_name, role, company, industry')
      .limit(limit)

    if (fetchError) throw fetchError

    const preview: { name: string; role: string | null; company: string | null; oldIndustry: string | null; newIndustry: string | null }[] = []

    // Process in batches
    for (let i = 0; i < (alumni?.length || 0); i += BATCH_SIZE) {
      const batch = alumni!.slice(i, i + BATCH_SIZE)
      const classifications = await classifyWithClaude(anthropic, batch)

      for (const person of batch) {
        const newIndustry = classifications.get(person.id)

        if (newIndustry !== person.industry) {
          preview.push({
            name: person.full_name,
            role: person.role,
            company: person.company,
            oldIndustry: person.industry,
            newIndustry: newIndustry ?? null
          })
        }
      }

      if (i + BATCH_SIZE < (alumni?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return NextResponse.json({
      preview: true,
      analyzed: alumni?.length || 0,
      changesFound: preview.length,
      changes: preview
    })

  } catch (error: any) {
    console.error('Preview industries error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to preview' },
      { status: 500 }
    )
  }
}
