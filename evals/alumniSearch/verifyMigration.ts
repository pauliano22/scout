/**
 * Read-only probe: is migration 023 (alumni embeddings) applied?
 *
 * This canNOT apply the migration — DDL must run via the Supabase SQL editor,
 * psql, or the Supabase CLI. It only INSPECTS current state through PostgREST
 * using the service-role key, which is all the access this environment has.
 *
 * Usage: tsx evals/alumniSearch/verifyMigration.ts
 * Env (from .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * What it can check:
 *   - alumni.embedding column exists (and is currently empty)   ✓ via PostgREST
 *   - match_alumni_semantic RPC exists + accepts the signature   ✓ via PostgREST
 * What it CANNOT check (no information_schema over PostgREST):
 *   - the ivfflat index — verify in SQL editor with the query printed below.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { join } from 'node:path'

config({ path: join(__dirname, '../../.env.local') })
config({ path: join(__dirname, '../../apps/web/.env.local') })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

async function main() {
  console.log(`Probing ${URL}\n`)

  // 0. Connectivity + corpus size.
  const { count: total, error: totalErr } = await supabase
    .from('alumni')
    .select('id', { count: 'exact', head: true })
  if (totalErr) {
    console.error('✗ Cannot read alumni table:', totalErr.message)
    console.error('  (network egress may be blocked from this environment, or creds invalid)')
    process.exit(2)
  }
  console.log(`✓ Connected. alumni rows: ${total}`)

  const { count: publicCount } = await supabase
    .from('alumni')
    .select('id', { count: 'exact', head: true })
    .eq('is_public', true)
  console.log(`  public alumni (is_public=true): ${publicCount}`)

  // 1. embedding column exists? Use a NON-head select so PostgREST returns a
  // parseable error body (head:true gives an empty body → empty error msg).
  const { error: colErr } = await supabase.from('alumni').select('id, embedding').limit(1)
  if (colErr) {
    const blob = JSON.stringify({ message: colErr.message, code: colErr.code, details: colErr.details, hint: colErr.hint })
    if (/does not exist|42703|embedding/.test(blob)) {
      console.log(`✗ alumni.embedding column: NOT FOUND — migration 023 not applied`)
    } else {
      console.log(`? alumni.embedding probe error: ${blob}`)
    }
  } else {
    // Column exists — now count how many are populated.
    const { count: embCount } = await supabase
      .from('alumni')
      .select('id', { count: 'exact', head: true })
      .not('embedding', 'is', null)
    console.log(`✓ alumni.embedding column: EXISTS. non-null embeddings: ${embCount} (expect 0 pre-backfill)`)
  }

  // 2. match_alumni_semantic RPC exists.
  const zeroVec = new Array(1536).fill(0)
  const { error: rpcErr } = await supabase.rpc('match_alumni_semantic', {
    query_embedding: zeroVec,
    exclude_ids: [],
    location_q: null,
    grad_year_min: null,
    grad_year_max: null,
    match_count: 1,
  })

  if (rpcErr) {
    if (/Could not find the function|does not exist|PGRST202|schema cache/.test(rpcErr.message)) {
      console.log(`✗ match_alumni_semantic RPC: NOT FOUND — migration 023 not applied (or PostgREST schema cache stale)`)
    } else {
      // Function exists but rejected the call for some other reason — still proves existence.
      console.log(`✓ match_alumni_semantic RPC: EXISTS (call returned: ${rpcErr.message})`)
    }
  } else {
    console.log(`✓ match_alumni_semantic RPC: EXISTS and callable`)
  }

  console.log(`
─── Index check (run manually in SQL editor — PostgREST can't see pg_indexes) ───
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'alumni' AND indexname = 'idx_alumni_embedding';
  -- expect one row with USING ivfflat (embedding vector_cosine_ops)
`)
}

main().catch((err) => {
  console.error('Probe failed:', err?.message ?? err)
  process.exit(2)
})
