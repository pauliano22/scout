// Embedding wrapper for the conversational alumni-search pipeline.
//
// One model, one dimension (1536), matching the `vector(1536)` column
// declared in migration 023. Provider isolated behind a single function so
// swapping vendors later is a one-line change (and so the unit tests / eval
// harness can stub it). OpenAI text-embedding-3-small is the default — small,
// cheap, 1536d natively. Set EMBEDDING_PROVIDER=voyage to switch.

const PROVIDER = process.env.EMBEDDING_PROVIDER ?? 'openai'

export const EMBEDDING_DIM = 1536

export class EmbeddingProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmbeddingProviderError'
  }
}

export async function embedText(text: string): Promise<number[]> {
  const input = text.trim().slice(0, 8000) // keep request small; rest is noise
  if (!input) throw new EmbeddingProviderError('Cannot embed empty input')

  if (PROVIDER === 'voyage') return embedVoyage(input)
  return embedOpenAI(input)
}

async function embedOpenAI(input: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new EmbeddingProviderError(
      'OPENAI_API_KEY missing — required for embedding-based alumni search',
    )
  }
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input,
      // 1536 is the native dim for this model, so this is just an assertion.
      dimensions: EMBEDDING_DIM,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new EmbeddingProviderError(`OpenAI embedding failed: ${res.status} ${detail.slice(0, 200)}`)
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] }
  const vec = json.data?.[0]?.embedding
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new EmbeddingProviderError(
      `OpenAI embedding had unexpected dim ${vec?.length ?? 'undefined'}`,
    )
  }
  return vec
}

async function embedVoyage(input: string): Promise<number[]> {
  const key = process.env.VOYAGE_API_KEY
  if (!key) {
    throw new EmbeddingProviderError(
      'VOYAGE_API_KEY missing — required when EMBEDDING_PROVIDER=voyage',
    )
  }
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'voyage-large-2',
      input: [input],
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new EmbeddingProviderError(`Voyage embedding failed: ${res.status} ${detail.slice(0, 200)}`)
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] }
  const vec = json.data?.[0]?.embedding
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new EmbeddingProviderError(
      `Voyage embedding had unexpected dim ${vec?.length ?? 'undefined'}`,
    )
  }
  return vec
}

/**
 * Concatenates the meaningful career fields of an alumni row into the single
 * string that gets embedded. Exported so the offline indexing script, the
 * profile-update hook (when we add one), and any future re-embed job all use
 * the EXACT same text shape — otherwise the index drifts vs the query
 * embedding and similarity scores stop being comparable.
 */
export function alumniEmbeddingText(row: {
  full_name?: string | null
  bio?: string | null
  display_headline?: string | null
  role?: string | null
  company?: string | null
  industry?: string | null
  location?: string | null
  sport?: string | null
  graduation_year?: number | null
  skills?: string[] | null
  work_history?: Array<{ title?: string | null; company?: string | null }> | null
  advice?: string | null
}): string {
  const parts: string[] = []
  if (row.full_name) parts.push(`Name: ${row.full_name}`)
  if (row.role || row.company) {
    parts.push(`Current role: ${[row.role, row.company].filter(Boolean).join(' at ')}`)
  }
  if (row.industry)       parts.push(`Industry: ${row.industry}`)
  if (row.location)       parts.push(`Location: ${row.location}`)
  if (row.sport)          parts.push(`Sport: ${row.sport}`)
  if (row.graduation_year) parts.push(`Class of ${row.graduation_year}`)
  if (row.display_headline) parts.push(`Headline: ${row.display_headline}`)
  if (row.bio)            parts.push(`Bio: ${row.bio}`)
  if (row.advice)         parts.push(`Willing to help with: ${row.advice}`)
  if (row.skills && row.skills.length > 0) {
    parts.push(`Skills: ${row.skills.join(', ')}`)
  }
  if (row.work_history && row.work_history.length > 0) {
    const wh = row.work_history
      .filter((w) => w && (w.title || w.company))
      .slice(0, 8)
      .map((w) => [w.title, w.company].filter(Boolean).join(' at '))
      .join('; ')
    if (wh) parts.push(`Past roles: ${wh}`)
  }
  return parts.join('\n')
}
