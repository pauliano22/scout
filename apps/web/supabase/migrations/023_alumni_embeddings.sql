-- =====================================================================
-- Migration 023 — Alumni semantic-search embeddings
-- =====================================================================
-- Adds a 1536-dim embedding column to `alumni` to match the existing
-- profiles.embedding column (see migration 005). 1536d matches both
-- OpenAI text-embedding-3-small and Voyage voyage-large-2 — picking
-- model is a runtime config, not a schema choice.
--
-- Privacy: the `match_alumni_semantic` RPC pre-filters to
-- is_public = true, so opted-out alumni never enter any candidate set.
-- The opt-out flag is `is_public` (see migration 001). No new flag is
-- introduced — the spec's "discoverable" is the existing is_public.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.alumni
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

-- IVFFlat for approximate cosine search. Matches the profiles index
-- in mig 005. `lists=100` is fine for our current alumni count
-- (~thousands); tune up if/when we cross ~100k rows.
--
-- NOTE: this index is created on an empty column, so its cluster centroids
-- are not optimized for the real corpus. After the embedding backfill, rebuild
-- it (`REINDEX INDEX idx_alumni_embedding;`) — see GO_LIVE.md step 5. Skipping
-- the rebuild degrades recall.
CREATE INDEX IF NOT EXISTS idx_alumni_embedding
  ON public.alumni
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Search RPC. Two-pass design mirrors how the rest of Scout retrieves:
--   1. exclude already-networked / already-swiped
--   2. filter by hard metadata (location ilike, grad year range)
--   3. order by cosine distance
--
-- Returns the full row the route needs to rerank + render. Reasoning
-- is added downstream by the LLM — this RPC stays pure retrieval.
CREATE OR REPLACE FUNCTION public.match_alumni_semantic(
  query_embedding vector(1536),
  exclude_ids     uuid[]   DEFAULT '{}',
  location_q      text     DEFAULT NULL,    -- ILIKE filter; NULL skips
  grad_year_min   int      DEFAULT NULL,
  grad_year_max   int      DEFAULT NULL,
  match_count     int      DEFAULT 30
)
RETURNS TABLE (
  id              uuid,
  full_name       text,
  email           text,
  linkedin_url    text,
  sport           text,
  graduation_year int,
  company         text,
  role            text,
  industry        text,
  location        text,
  avatar_url      text,
  photo_url       text,
  bio             text,
  display_headline text,
  similarity      float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.id,
    a.full_name,
    a.email,
    a.linkedin_url,
    a.sport,
    a.graduation_year,
    a.company,
    a.role,
    a.industry,
    a.location,
    a.avatar_url,
    a.photo_url,
    a.bio,
    a.display_headline,
    1 - (a.embedding <=> query_embedding) AS similarity
  FROM public.alumni a
  WHERE a.is_public = true
    AND a.embedding IS NOT NULL
    AND NOT (a.id = ANY(exclude_ids))
    AND (location_q IS NULL    OR a.location ILIKE '%' || location_q || '%')
    AND (grad_year_min IS NULL OR a.graduation_year >= grad_year_min)
    AND (grad_year_max IS NULL OR a.graduation_year <= grad_year_max)
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_alumni_semantic(
  vector, uuid[], text, int, int, int
) TO authenticated;
