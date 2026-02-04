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
// MOCK DATA (for development/testing)
// ============================================

const MOCK_JOBS: Partial<Job>[] = [
  {
    title: 'Software Engineer',
    company: 'Google',
    location: 'Mountain View, CA',
    salary_range: '$150,000 - $200,000',
    job_type: 'hybrid',
    industry: 'Technology',
    seniority_level: 'mid',
    description: 'Join our team building the next generation of search and AI products. We\'re looking for engineers who thrive in a collaborative environment and want to impact billions of users worldwide.',
    external_url: 'https://careers.google.com/jobs/1',
    external_id: 'google-1',
    source: 'mock',
  },
  {
    title: 'Investment Banking Analyst',
    company: 'Goldman Sachs',
    location: 'New York, NY',
    salary_range: '$100,000 - $150,000',
    job_type: 'onsite',
    industry: 'Finance',
    seniority_level: 'entry',
    description: 'Seeking motivated analysts for our M&A division. You\'ll work on high-profile transactions, build financial models, and collaborate with senior bankers on client presentations.',
    external_url: 'https://careers.gs.com/jobs/1',
    external_id: 'gs-1',
    source: 'mock',
  },
  {
    title: 'Management Consultant',
    company: 'McKinsey & Company',
    location: 'Chicago, IL',
    salary_range: '$120,000 - $180,000',
    job_type: 'hybrid',
    industry: 'Consulting',
    seniority_level: 'entry',
    description: 'Help Fortune 500 companies solve their toughest challenges. As a consultant, you\'ll analyze complex business problems and develop actionable strategies for transformation.',
    external_url: 'https://careers.mckinsey.com/jobs/1',
    external_id: 'mck-1',
    source: 'mock',
  },
  {
    title: 'Product Manager',
    company: 'Meta',
    location: 'Menlo Park, CA',
    salary_range: '$140,000 - $190,000',
    job_type: 'hybrid',
    industry: 'Technology',
    seniority_level: 'mid',
    description: 'Drive product strategy for our social platforms. You\'ll define product roadmaps, work cross-functionally with engineering and design, and launch features to billions of users.',
    external_url: 'https://careers.meta.com/jobs/1',
    external_id: 'meta-1',
    source: 'mock',
  },
  {
    title: 'Data Scientist',
    company: 'Netflix',
    location: 'Los Gatos, CA',
    salary_range: '$160,000 - $220,000',
    job_type: 'remote',
    industry: 'Technology',
    seniority_level: 'mid',
    description: 'Build recommendation systems and analyze viewer behavior at scale. Use machine learning and statistical modeling to personalize content for 200M+ subscribers.',
    external_url: 'https://jobs.netflix.com/jobs/1',
    external_id: 'nflx-1',
    source: 'mock',
  },
  {
    title: 'Private Equity Associate',
    company: 'Blackstone',
    location: 'New York, NY',
    salary_range: '$150,000 - $250,000',
    job_type: 'onsite',
    industry: 'Finance',
    seniority_level: 'entry',
    description: 'Join our PE team to evaluate investment opportunities, conduct due diligence, and support portfolio company management. Prior banking or consulting experience preferred.',
    external_url: 'https://careers.blackstone.com/jobs/1',
    external_id: 'bx-1',
    source: 'mock',
  },
  {
    title: 'Healthcare Consultant',
    company: 'Bain & Company',
    location: 'Boston, MA',
    salary_range: '$130,000 - $170,000',
    job_type: 'hybrid',
    industry: 'Healthcare',
    seniority_level: 'entry',
    description: 'Advise healthcare organizations on strategic challenges including digital transformation, operational improvement, and M&A. Make an impact in a rapidly evolving industry.',
    external_url: 'https://careers.bain.com/jobs/1',
    external_id: 'bain-1',
    source: 'mock',
  },
  {
    title: 'Associate Attorney',
    company: 'Kirkland & Ellis',
    location: 'Chicago, IL',
    salary_range: '$215,000 - $235,000',
    job_type: 'onsite',
    industry: 'Law',
    seniority_level: 'entry',
    description: 'Join our corporate practice group working on M&A transactions, private equity deals, and capital markets matters. Strong academic credentials and excellent writing skills required.',
    external_url: 'https://careers.kirkland.com/jobs/1',
    external_id: 'ke-1',
    source: 'mock',
  },
  {
    title: 'Marketing Manager',
    company: 'Nike',
    location: 'Portland, OR',
    salary_range: '$95,000 - $130,000',
    job_type: 'hybrid',
    industry: 'Media',
    seniority_level: 'mid',
    description: 'Lead marketing campaigns for Nike\'s athletic footwear division. Develop brand strategies, manage agency relationships, and drive consumer engagement across digital channels.',
    external_url: 'https://jobs.nike.com/jobs/1',
    external_id: 'nike-1',
    source: 'mock',
  },
  {
    title: 'Financial Analyst',
    company: 'JPMorgan Chase',
    location: 'New York, NY',
    salary_range: '$85,000 - $110,000',
    job_type: 'hybrid',
    industry: 'Finance',
    seniority_level: 'entry',
    description: 'Support corporate finance activities including budgeting, forecasting, and variance analysis. Build financial models and present insights to senior leadership.',
    external_url: 'https://careers.jpmorgan.com/jobs/1',
    external_id: 'jpm-1',
    source: 'mock',
  },
  {
    title: 'UX Designer',
    company: 'Apple',
    location: 'Cupertino, CA',
    salary_range: '$130,000 - $180,000',
    job_type: 'onsite',
    industry: 'Technology',
    seniority_level: 'mid',
    description: 'Design intuitive user experiences for Apple\'s hardware and software products. Collaborate with engineering and product teams to create delightful interactions.',
    external_url: 'https://jobs.apple.com/jobs/1',
    external_id: 'aapl-1',
    source: 'mock',
  },
  {
    title: 'Strategy Analyst',
    company: 'Boston Consulting Group',
    location: 'Los Angeles, CA',
    salary_range: '$110,000 - $150,000',
    job_type: 'hybrid',
    industry: 'Consulting',
    seniority_level: 'entry',
    description: 'Work alongside consultants on strategic engagements for Fortune 500 clients. Conduct research, analyze data, and develop recommendations for business transformation.',
    external_url: 'https://careers.bcg.com/jobs/1',
    external_id: 'bcg-1',
    source: 'mock',
  },
]

// ============================================
// JOB FETCHER (plug in real API later)
// ============================================

/**
 * Fetch jobs from external API.
 * Currently returns mock data - plug in JSearch/RapidAPI key later.
 *
 * To use JSearch API:
 * 1. Get API key from RapidAPI
 * 2. Set JSEARCH_API_KEY in .env.local
 * 3. Uncomment the real implementation below
 */
export async function fetchJobs(params: JobSearchParams): Promise<JobFetchResult> {
  // Check if we have JSearch API key configured
  const apiKey = process.env.JSEARCH_API_KEY

  if (apiKey) {
    // ============================================
    // REAL IMPLEMENTATION (JSearch API)
    // ============================================
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
      throw new Error(`JSearch API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      jobs: data.data.map((job: Record<string, unknown>) => ({
        title: job.job_title as string,
        company: job.employer_name as string,
        location: job.job_city ? `${job.job_city}, ${job.job_state}` : job.job_country as string,
        salary_range: job.job_min_salary && job.job_max_salary
          ? `$${job.job_min_salary} - $${job.job_max_salary}`
          : null,
        job_type: job.job_is_remote ? 'remote' : 'onsite',
        description: job.job_description as string,
        external_url: job.job_apply_link as string,
        external_id: job.job_id as string,
        source: 'jsearch',
        industry: job.job_category as string | null,
        posted_at: job.job_posted_at_datetime_utc as string,
      })),
      total: (data.total as number) || data.data.length,
      page: params.page || 1,
    }
  }

  // ============================================
  // MOCK IMPLEMENTATION (fallback)
  // ============================================
  const filtered = MOCK_JOBS.filter(job => {
    if (params.query) {
      const q = params.query.toLowerCase()
      const matches =
        job.title?.toLowerCase().includes(q) ||
        job.company?.toLowerCase().includes(q) ||
        job.industry?.toLowerCase().includes(q) ||
        job.description?.toLowerCase().includes(q)
      if (!matches) return false
    }
    if (params.location && job.location) {
      if (!job.location.toLowerCase().includes(params.location.toLowerCase())) {
        return false
      }
    }
    if (params.remote_only && job.job_type !== 'remote') {
      return false
    }
    return true
  })

  return {
    jobs: filtered,
    total: filtered.length,
    page: params.page || 1,
  }
}

// ============================================
// EMBEDDING FUNCTIONS (Voyage AI)
// ============================================

/**
 * Generate embedding using Voyage AI
 * Voyage AI provides high-quality embeddings optimized for retrieval
 *
 * Model: voyage-large-2 (1536 dimensions)
 */
export async function generateEmbedding(text: string, inputType: 'document' | 'query' = 'document'): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY not configured')
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
    throw new Error(`Voyage API error: ${response.status} - ${error}`)
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
