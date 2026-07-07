-- IDEA 34: Automated Testimonial Collection Pipeline
-- Creates tables for collecting and featuring alumni testimonials.

-- ============================================
-- TESTIMONIALS
-- ============================================
CREATE TABLE IF NOT EXISTS public.testimonials (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alumni_id         UUID NOT NULL REFERENCES public.alumni(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'email',  -- 'email' | 'web' | 'admin'
  featured          BOOLEAN NOT NULL DEFAULT false,
  permission_granted BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TESTIMONIAL REQUESTS (outreach tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS public.testimonial_requests (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alumni_id         UUID NOT NULL REFERENCES public.alumni(id) ON DELETE CASCADE,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded         BOOLEAN NOT NULL DEFAULT false,
  response_at       TIMESTAMPTZ,
  UNIQUE(alumni_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_testimonials_featured
  ON public.testimonials (featured, created_at DESC)
  WHERE featured = true;

CREATE INDEX IF NOT EXISTS idx_testimonials_alumni
  ON public.testimonials (alumni_id);

CREATE INDEX IF NOT EXISTS idx_testimonial_requests_alumni
  ON public.testimonial_requests (alumni_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonial_requests ENABLE ROW LEVEL SECURITY;

-- Testimonials: service role full access; anon can read featured
CREATE POLICY "Service role — all testimonials"
  ON public.testimonials
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Anyone can read featured testimonials"
  ON public.testimonials FOR SELECT
  USING (featured = true);

-- Testimonial requests: service role only
CREATE POLICY "Service role — all testimonial_requests"
  ON public.testimonial_requests
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
