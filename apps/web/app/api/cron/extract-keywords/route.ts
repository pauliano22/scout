// POST /api/cron/extract-keywords — reads alumni bios that haven't been
// processed, extracts industry keywords, skills, certifications, and career
// milestones using lightweight pattern matching, and persists results to the
// profile_keywords table.
//
// Protected by CRON_SECRET.
// Recommended schedule: every 6 hours (0 */6 * * *)
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Alumni } from '@scout/shared/types/database'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ─── Auth ───────────────────────────────────────────────────────────────────

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.headers.get('x-cron-secret') === secret
  )
}

// ─── Keyword lists (simple string matching, not ML) ─────────────────────────

const INDUSTRIES = [
  'technology', 'tech', 'software', 'saas', 'fintech', 'healthtech',
  'finance', 'investment banking', 'private equity', 'venture capital',
  'hedge fund', 'asset management', 'wealth management',
  'consulting', 'management consulting', 'strategy consulting',
  'healthcare', 'biotech', 'pharmaceutical', 'medtech',
  'law', 'legal',
  'media', 'entertainment', 'publishing', 'advertising',
  'real estate',
  'non-profit', 'nonprofit', 'social impact',
  'government', 'public policy',
  'education', 'edtech',
  'sports', 'athletics', 'sports management',
  'energy', 'renewable energy', 'clean tech',
  'e-commerce', 'retail',
  'manufacturing',
  'insurance',
  'hospitality',
  'defense', 'aerospace',
]

const SKILLS = [
  'python', 'javascript', 'typescript', 'react', 'node', 'node.js',
  'java', 'c++', 'sql', 'aws', 'gcp', 'azure',
  'product management', 'project management', 'program management',
  'data science', 'machine learning', 'ai', 'artificial intelligence',
  'data analysis', 'data analytics',
  'mergers and acquisitions', 'm&a', 'due diligence',
  'financial modeling', 'valuation', 'financial analysis',
  'business development', 'business strategy',
  'marketing', 'digital marketing', 'growth marketing',
  'sales', 'business development',
  'operations', 'operations management',
  'people management', 'team leadership', 'leadership',
  'public speaking', 'presentation', 'negotiation',
  'ux design', 'ui design', 'product design',
  'blockchain', 'crypto', 'web3',
  'devops', 'ci/cd', 'kubernetes', 'docker',
  'tableau', 'power bi', 'excel',
  'r', 'matlab', 'spss', 'stata',
  'sql', 'nosql', 'mongodb', 'postgresql', 'postgres',
  'agile', 'scrum',
  'supply chain', 'logistics',
  'human resources', 'hr', 'talent acquisition',
  'public relations', 'pr', 'communications',
  'corporate development', 'corporate strategy',
]

const CERTIFICATIONS = [
  'cpa', 'cfa', 'pmp', 'series 7', 'series 63', 'series 65', 'series 66',
  'caia', 'frm', 'cfa charterholder',
  'six sigma', 'lean six sigma',
  'cissp', 'ceh', 'security+',
  'aws certified', 'gcp certified', 'azure certified',
  'solutions architect',
  'comptia',
  'cfe', 'cia',
  'cscp', 'cpsm',
  'fpc', 'cpp',
  'scrum master', 'safe agilist',
  'cfp', 'chfc',
]

// ─── Extraction logic ───────────────────────────────────────────────────────

interface ExtractedKeyword {
  keyword: string
  category: 'skill' | 'industry' | 'certification' | 'milestone'
}

function extractKeywords(bio: string): ExtractedKeyword[] {
  const results: ExtractedKeyword[] = []
  const lower = bio.toLowerCase()
  const seen = new Set<string>()

  function add(word: string, category: ExtractedKeyword['category']) {
    const key = `${category}:${word}`
    if (!seen.has(key)) {
      seen.add(key)
      // Capitalise first letter for display
      const display = word.charAt(0).toUpperCase() + word.slice(1)
      results.push({ keyword: display, category })
    }
  }

  // Industry keywords
  for (const ind of INDUSTRIES) {
    // Match as whole word or phrase
    const escaped = ind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')
    if (regex.test(lower)) {
      add(ind, 'industry')
    }
  }

  // Skill keywords
  for (const skill of SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')
    if (regex.test(lower)) {
      add(skill, 'skill')
    }
  }

  // Certification keywords
  for (const cert of CERTIFICATIONS) {
    const escaped = cert.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')
    if (regex.test(lower)) {
      add(cert, 'certification')
    }
  }

  // Milestones: detect role transitions (e.g. "from X to Y", "promoted to")
  const milestonePatterns = [
    /(?:promoted to|transitioned to|moved to|advanced to)\s+([a-z\s]+?)(?:\.|,|$|\s+at\s+)/gi,
    /(?:led|managed|headed|directed)\s+(?:a\s+|the\s+)?([a-z\s]+?)\s+(?:team|department|group|division|initiative)/gi,
    /founded\s+(?:a\s+)?([a-z\s]+?)(?:\.|,|$|\s+in\s+)/gi,
  ]

  for (const pattern of milestonePatterns) {
    const matches = bio.matchAll(pattern)
    for (const m of matches) {
      const milestone = m[1]?.trim()
      if (milestone && milestone.length > 2 && milestone.length < 80) {
        add(milestone, 'milestone')
      }
    }
  }

  return results
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    // Fetch alumni with bios that have NOT been processed for keyword extraction
    const { data: alumniList, error: fetchError } = await sb
      .from('alumni')
      .select('id, bio')
      .eq('keywords_extracted', false)
      .not('bio', 'is', null)
      .limit(100)

    if (fetchError) {
      console.error('[extract-keywords] fetch failed:', fetchError.message)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const extracted: Array<{ alumni_id: string; rows: ExtractedKeyword[] }> = []
    const processedIds: string[] = []

    for (const alum of alumniList ?? []) {
      if (!alum.bio) continue

      const keywords = extractKeywords(alum.bio)
      extracted.push({ alumni_id: alum.id, rows: keywords })
      processedIds.push(alum.id)
    }

    // Insert keywords into profile_keywords
    let insertedCount = 0

    for (const entry of extracted) {
      if (entry.rows.length === 0) continue

      const { error: insertError } = await sb
        .from('profile_keywords')
        .insert(
          entry.rows.map((r) => ({
            alumni_id: entry.alumni_id,
            keyword: r.keyword,
            category: r.category,
            source: 'extraction',
          })),
        )

      if (insertError) {
        console.error(
          `[extract-keywords] insert failed for ${entry.alumni_id}:`,
          insertError.message,
        )
      } else {
        insertedCount += entry.rows.length
      }
    }

    // Mark processed alumni as done
    if (processedIds.length > 0) {
      const { error: updateError } = await sb
        .from('alumni')
        .update({ keywords_extracted: true })
        .in('id', processedIds)

      if (updateError) {
        console.error('[extract-keywords] update failed:', updateError.message)
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      processed: processedIds.length,
      keywords_found: insertedCount,
      keywords_by_profile: extracted.map((e) => ({
        alumni_id: e.alumni_id,
        count: e.rows.length,
      })),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
