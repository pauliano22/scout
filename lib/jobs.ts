import { Job } from '@/types/database'

// ============================================
// TYPES
// ============================================

export interface JobSearchParams {
  query: string
  location?: string
  remote_only?: boolean
  page?: number
  num_pages?: number
}

export interface JobFetchResult {
  jobs: Partial<Job>[]
  total: number
  page: number
}

// ============================================
// JOB FETCHER (Production Mode - JSearch API)
// ============================================

/**
 * Fetch jobs from JSearch API (RapidAPI)
 * Requires JSEARCH_API_KEY environment variable
 */
export async function fetchJobs(params: JobSearchParams): Promise<JobFetchResult> {
  const apiKey = process.env.JSEARCH_API_KEY

  if (!apiKey) {
    throw new Error(
      'JSEARCH_API_KEY is not configured. ' +
      'Please add your JSearch API key to .env.local: JSEARCH_API_KEY=your_key_here\n' +
      'Get your API key from: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch'
    )
  }

  const url = new URL('https://jsearch.p.rapidapi.com/search')
  url.searchParams.set('query', params.query)
  if (params.location) url.searchParams.set('location', params.location)
  if (params.remote_only) url.searchParams.set('remote_jobs_only', 'true')
  url.searchParams.set('page', String(params.page || 1))
  url.searchParams.set('num_pages', String(params.num_pages || 1))

  const response = await fetch(url.toString(), {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`JSearch API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  if (!data.data || !Array.isArray(data.data)) {
    return { jobs: [], total: 0, page: params.page || 1 }
  }

  return {
    jobs: data.data.map((job: Record<string, unknown>) => ({
      title: job.job_title as string,
      company: job.employer_name as string,
      location: job.job_city
        ? `${job.job_city}${job.job_state ? `, ${job.job_state}` : ''}`
        : (job.job_country as string) || null,
      salary_range: job.job_min_salary && job.job_max_salary
        ? `$${Number(job.job_min_salary).toLocaleString()} - $${Number(job.job_max_salary).toLocaleString()}`
        : null,
      job_type: job.job_is_remote ? 'remote' : (job.job_employment_type === 'FULLTIME' ? 'onsite' : 'hybrid'),
      description: job.job_description as string,
      external_url: (job.job_apply_link as string) || (job.job_google_link as string),
      external_id: job.job_id as string,
      source: 'jsearch',
      industry: guessIndustry(job.job_title as string, job.employer_name as string),
      seniority_level: guessSeniority(job.job_title as string),
      posted_at: job.job_posted_at_datetime_utc as string,
    })),
    total: (data.total as number) || data.data.length,
    page: params.page || 1,
  }
}

/**
 * Guess industry from job title and company name
 */
function guessIndustry(title: string, company: string): string | null {
  const text = `${title} ${company}`.toLowerCase()

  if (text.includes('bank') || text.includes('finance') || text.includes('investment') ||
      text.includes('capital') || text.includes('equity') || text.includes('trading')) {
    return 'Finance'
  }
  if (text.includes('software') || text.includes('engineer') || text.includes('developer') ||
      text.includes('tech') || text.includes('data') || text.includes('cloud') || text.includes('ai')) {
    return 'Technology'
  }
  if (text.includes('consult') || text.includes('advisory') || text.includes('strategy')) {
    return 'Consulting'
  }
  if (text.includes('health') || text.includes('medical') || text.includes('pharma') ||
      text.includes('biotech') || text.includes('hospital')) {
    return 'Healthcare'
  }
  if (text.includes('law') || text.includes('legal') || text.includes('attorney') || text.includes('counsel')) {
    return 'Law'
  }
  if (text.includes('media') || text.includes('market') || text.includes('advertis') ||
      text.includes('brand') || text.includes('communications')) {
    return 'Media'
  }

  return null
}

/**
 * Guess seniority level from job title
 */
function guessSeniority(title: string): 'internship' | 'entry' | 'mid' | 'senior' | 'executive' | null {
  const text = title.toLowerCase()

  // Internship detection
  if (text.includes('intern') || text.includes('co-op') || text.includes('trainee') ||
      text.includes('summer analyst')) {
    return 'internship'
  }

  if (text.includes('senior') || text.includes('sr.') || text.includes('lead') ||
      text.includes('principal') || text.includes('staff')) {
    return 'senior'
  }
  if (text.includes('director') || text.includes('vp') || text.includes('chief') ||
      text.includes('head of') || text.includes('president')) {
    return 'executive'
  }
  if (text.includes('junior') || text.includes('jr.') || text.includes('entry') ||
      text.includes('associate') || text.includes('analyst') || text.includes('coordinator') ||
      text.includes('assistant') || text.includes('new grad')) {
    return 'entry'
  }

  return 'mid'
}

// ============================================
// EMBEDDING FUNCTIONS (Voyage AI)
// ============================================

/**
 * Generate embedding using Voyage AI
 * Requires VOYAGE_API_KEY environment variable
 *
 * Model: voyage-large-2 (1536 dimensions)
 */
export async function generateEmbedding(text: string, inputType: 'document' | 'query' = 'document'): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY

  if (!apiKey) {
    throw new Error(
      'VOYAGE_API_KEY is not configured. ' +
      'Please add your Voyage AI API key to .env.local: VOYAGE_API_KEY=your_key_here\n' +
      'Get your API key from: https://www.voyageai.com/'
    )
  }

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'voyage-large-2', // 1536 dimensions, matches our vector column
      input: text,
      input_type: inputType,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voyage API error (${response.status}): ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

/**
 * Generate embedding for job description
 */
export async function generateJobEmbedding(job: Partial<Job>): Promise<number[]> {
  const text = `Job Title: ${job.title}
Company: ${job.company}
Industry: ${job.industry || 'Not specified'}
Location: ${job.location || 'Not specified'}
Type: ${job.job_type || 'Not specified'}
Level: ${job.seniority_level || 'Not specified'}
Description: ${job.description || 'No description provided'}`

  return generateEmbedding(text, 'document')
}

/**
 * Generate embedding for user profile (for job matching)
 */
export async function generateProfileEmbedding(profile: {
  interests?: string | null
  industry?: string | null
  role?: string | null
  company?: string | null
  sport?: string | null
  location?: string | null
}): Promise<number[]> {
  const text = `Career Interests: ${profile.interests || 'Open to opportunities'}
Target Industry: ${profile.industry || 'Open to all industries'}
Current Role: ${profile.role || 'Student or recent graduate'}
Current Company: ${profile.company || 'Not specified'}
Location Preference: ${profile.location || 'Flexible'}
Background: Former ${profile.sport || 'college'} athlete`

  return generateEmbedding(text, 'query')
}

/**
 * Generate embedding for a search query
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  return generateEmbedding(query, 'query')
}
