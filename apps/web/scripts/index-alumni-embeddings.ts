/**
 * Backfill / refresh alumni embeddings for conversational search.
 *
 * Usage:
 *   npm run embed:alumni                  # only rows missing embedding
 *   npm run embed:alumni -- --all         # re-embed everyone
 *   npm run embed:alumni -- --since=2024-01-01  # re-embed rows updated since
 *
 * Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY (or
 * VOYAGE_API_KEY + EMBEDDING_PROVIDER=voyage).
 *
 * The script is idempotent. It processes rows in batches of 50 with a small
 * delay so we don't hammer the embedding provider's rate limit. Failures on a
 * single row don't abort the run — they're logged and skipped.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { alumniEmbeddingText, embedText } from '../lib/search/embeddings'

config({ path: '.env.local' })
config({ path: '.env' })

const BATCH_SIZE = 50
const DELAY_MS = 250

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface AlumniRow {
  id: string
  full_name: string | null
  bio: string | null
  display_headline: string | null
  role: string | null
  company: string | null
  industry: string | null
  location: string | null
  sport: string | null
  graduation_year: number | null
  skills: string[] | null
  work_history: Array<{ title?: string | null; company?: string | null }> | null
  advice: string | null
}

function parseArgs() {
  const args = process.argv.slice(2)
  const all = args.includes('--all')
  const since = args.find((a) => a.startsWith('--since='))?.slice('--since='.length)
  return { all, since }
}

async function fetchTargets({ all, since }: { all: boolean; since?: string }): Promise<AlumniRow[]> {
  let q = supabase
    .from('alumni')
    .select(
      'id, full_name, bio, display_headline, role, company, industry, location, sport, graduation_year, skills, work_history, advice',
    )
    .eq('is_public', true)

  if (!all) {
    // Only rows whose text content has changed since they were last embedded,
    // OR rows that have never been embedded at all.
    q = q.or('embedding.is.null,embedding_updated_at.is.null')
  }
  if (since) {
    q = q.gte('updated_at', since)
  }

  const { data, error } = await q.limit(50000)
  if (error) {
    console.error('Failed to fetch alumni:', error.message)
    process.exit(1)
  }
  return (data ?? []) as AlumniRow[]
}

async function embedOne(row: AlumniRow): Promise<boolean> {
  const text = alumniEmbeddingText(row)
  if (!text.trim()) {
    // Nothing meaningful to embed — skip. These rows won't appear in
    // semantic search until they get more data, which is the correct outcome.
    return false
  }
  let vec: number[]
  try {
    vec = await embedText(text)
  } catch (err: any) {
    console.warn(`  ✗ ${row.id} embed failed: ${err.message}`)
    return false
  }

  const { error } = await supabase
    .from('alumni')
    .update({ embedding: vec, embedding_updated_at: new Date().toISOString() })
    .eq('id', row.id)

  if (error) {
    console.warn(`  ✗ ${row.id} update failed: ${error.message}`)
    return false
  }
  return true
}

async function main() {
  const args = parseArgs()
  const targets = await fetchTargets(args)
  console.log(`Embedding ${targets.length} alumni rows (provider: ${process.env.EMBEDDING_PROVIDER ?? 'openai'})`)

  let ok = 0
  let skipped = 0
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map(embedOne))
    ok += results.filter(Boolean).length
    skipped += results.filter((r) => !r).length
    console.log(`  ${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length}  (+${results.filter(Boolean).length})`)
    if (i + BATCH_SIZE < targets.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }

  console.log(`\nDone. embedded=${ok}  skipped=${skipped}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
