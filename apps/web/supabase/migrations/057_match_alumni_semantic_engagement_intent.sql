-- Migration 057: return engagement_intent from match_alumni_semantic.
--
-- The agent sourcing pass (lib/agent/sourceAlumni.ts) scores this RPC's rows
-- with the shared scorer, which now weighs alumni.engagement_intent (mig 056):
-- +12 for here_to_help/both, -12 for seeking_employment. The RPC (mig 023)
-- predates the column, so scoring saw undefined → 0 and the agent path
-- silently ignored the signal. Adding a column to RETURNS TABLE requires
-- DROP + CREATE (CREATE OR REPLACE cannot change a function's result type).
--
-- Extra returned columns are additive: PostgREST serializes rows to JSON, so
-- existing callers that don't read engagement_intent are unaffected.

BEGIN;

DROP FUNCTION IF EXISTS public.match_alumni_semantic(
  vector, uuid[], text, int, int, int
);

CREATE FUNCTION public.match_alumni_semantic(
  query_embedding vector(1536),
  exclude_ids     uuid[]   DEFAULT '{}',
  location_q      text     DEFAULT NULL,    -- ILIKE filter; NULL skips
  grad_year_min   int      DEFAULT NULL,
  grad_year_max   int      DEFAULT NULL,
  match_count     int      DEFAULT 30
)
RETURNS TABLE (
  id                uuid,
  full_name         text,
  email             text,
  linkedin_url      text,
  sport             text,
  graduation_year   int,
  company           text,
  role              text,
  industry          text,
  location          text,
  avatar_url        text,
  photo_url         text,
  bio               text,
  display_headline  text,
  engagement_intent text,
  similarity        float
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
    a.engagement_intent,
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

COMMIT;
