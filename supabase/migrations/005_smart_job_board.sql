-- ============================================
-- SMART JOB BOARD SCHEMA
-- Migration 005
-- ============================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- JOBS TABLE
-- ============================================

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Core job info
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  salary_range TEXT,
  job_type TEXT CHECK (job_type IN ('remote', 'hybrid', 'onsite')),
  description TEXT,

  -- External source tracking
  external_url TEXT NOT NULL,
  external_id TEXT,
  source TEXT DEFAULT 'manual', -- 'jsearch', 'linkedin', 'manual', etc.

  -- Categorization
  industry TEXT,
  seniority_level TEXT CHECK (seniority_level IN ('entry', 'mid', 'senior', 'executive')),

  -- Vector embedding for semantic search (Voyage large-2 = 1536 dimensions)
  embedding vector(1536),

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  posted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate jobs
  CONSTRAINT jobs_external_url_unique UNIQUE (external_url)
);

-- ============================================
-- USER JOB INTERACTIONS TABLE
-- ============================================

CREATE TABLE public.user_job_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('saved', 'applied', 'dismissed', 'viewed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT user_job_interactions_unique UNIQUE (user_id, job_id, interaction_type)
);

-- ============================================
-- ADD EMBEDDING TO PROFILES
-- ============================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ============================================
-- INDEXES
-- ============================================

-- Job search indexes
CREATE INDEX idx_jobs_industry ON public.jobs(industry);
CREATE INDEX idx_jobs_location ON public.jobs(location);
CREATE INDEX idx_jobs_job_type ON public.jobs(job_type);
CREATE INDEX idx_jobs_is_active ON public.jobs(is_active);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);

-- Vector similarity index (IVFFlat for faster approximate search)
-- Note: IVFFlat requires at least 100 rows to work well
-- For small datasets, queries will still work but use sequential scan
CREATE INDEX idx_jobs_embedding ON public.jobs
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_profiles_embedding ON public.profiles
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- User interactions index
CREATE INDEX idx_user_job_interactions_user ON public.user_job_interactions(user_id);
CREATE INDEX idx_user_job_interactions_job ON public.user_job_interactions(job_id);

-- ============================================
-- VECTOR MATCHING FUNCTIONS
-- ============================================

-- Match jobs to a user based on embedding similarity
CREATE OR REPLACE FUNCTION match_jobs(
  user_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  company TEXT,
  location TEXT,
  salary_range TEXT,
  job_type TEXT,
  description TEXT,
  external_url TEXT,
  industry TEXT,
  seniority_level TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.title,
    j.company,
    j.location,
    j.salary_range,
    j.job_type,
    j.description,
    j.external_url,
    j.industry,
    j.seniority_level,
    1 - (j.embedding <=> user_embedding) AS similarity
  FROM public.jobs j
  WHERE
    j.is_active = true
    AND j.embedding IS NOT NULL
    AND 1 - (j.embedding <=> user_embedding) > match_threshold
  ORDER BY j.embedding <=> user_embedding
  LIMIT match_count;
END;
$$;

-- Get job recommendations for a specific user (using their profile embedding)
CREATE OR REPLACE FUNCTION get_job_recommendations(
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  company TEXT,
  location TEXT,
  salary_range TEXT,
  job_type TEXT,
  description TEXT,
  external_url TEXT,
  industry TEXT,
  seniority_level TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_embedding vector(1536);
BEGIN
  -- Get user's embedding
  SELECT embedding INTO v_user_embedding
  FROM public.profiles
  WHERE profiles.id = p_user_id;

  -- If user has no embedding, return empty
  IF v_user_embedding IS NULL THEN
    RETURN;
  END IF;

  -- Return matched jobs excluding already interacted
  RETURN QUERY
  SELECT
    j.id,
    j.title,
    j.company,
    j.location,
    j.salary_range,
    j.job_type,
    j.description,
    j.external_url,
    j.industry,
    j.seniority_level,
    1 - (j.embedding <=> v_user_embedding) AS similarity
  FROM public.jobs j
  WHERE
    j.is_active = true
    AND j.embedding IS NOT NULL
    AND 1 - (j.embedding <=> v_user_embedding) > match_threshold
    AND NOT EXISTS (
      SELECT 1 FROM public.user_job_interactions uji
      WHERE uji.job_id = j.id
      AND uji.user_id = p_user_id
      AND uji.interaction_type IN ('dismissed', 'applied')
    )
  ORDER BY j.embedding <=> v_user_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_job_interactions ENABLE ROW LEVEL SECURITY;

-- Jobs: Anyone authenticated can read active jobs
CREATE POLICY "Anyone can view active jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Jobs: Service role can insert/update (for sync scripts)
CREATE POLICY "Service role can manage jobs"
  ON public.jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User interactions: Users can only manage their own
CREATE POLICY "Users can view own job interactions"
  ON public.user_job_interactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own job interactions"
  ON public.user_job_interactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own job interactions"
  ON public.user_job_interactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own job interactions"
  ON public.user_job_interactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
