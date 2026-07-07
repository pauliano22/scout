-- IDEA 21: Image Optimization Pipeline
-- Creates image_cache table for storing optimized image URLs

CREATE TABLE IF NOT EXISTS public.image_cache (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  original_url    text NOT NULL,
  optimized_urls  jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  UNIQUE (original_url)
);

-- Index for fast lookup by original URL
CREATE INDEX IF NOT EXISTS idx_image_cache_original_url
  ON public.image_cache (original_url);

-- Index for expiry-based cleanup
CREATE INDEX IF NOT EXISTS idx_image_cache_created_at
  ON public.image_cache (created_at);

-- RLS: service-role only (internal API)
ALTER TABLE public.image_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only — select image_cache"
  ON public.image_cache FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role only — insert image_cache"
  ON public.image_cache FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role only — update image_cache"
  ON public.image_cache FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role only — delete image_cache"
  ON public.image_cache FOR DELETE
  USING (auth.role() = 'service_role');
