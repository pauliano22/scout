-- Migration 036: Smart Jobs Board — job_listings & job_applications
--
-- A dedicated, filterable jobs board where alumni can post listings
-- and student-athletes can browse and apply inline.

CREATE TABLE IF NOT EXISTS public.job_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  location        TEXT,
  description     TEXT,
  employment_type TEXT CHECK (employment_type IN ('full-time','part-time','contract','internship','temporary')),
  salary_range    TEXT,
  application_url TEXT,
  posted_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_tags      TEXT[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_listing_id  UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  applicant_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cover_note      TEXT,
  resume_url      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','contacted','rejected','hired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_applications_unique UNIQUE (job_listing_id, applicant_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_listings_posted_by   ON public.job_listings(posted_by);
CREATE INDEX IF NOT EXISTS idx_job_listings_is_active   ON public.job_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_job_listings_created_at  ON public.job_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_listings_sport_tags  ON public.job_listings USING GIN (sport_tags);
CREATE INDEX IF NOT EXISTS idx_job_listings_company     ON public.job_listings(company);
CREATE INDEX IF NOT EXISTS idx_job_listings_location    ON public.job_listings(location);
CREATE INDEX IF NOT EXISTS idx_job_listings_employment_type ON public.job_listings(employment_type);
CREATE INDEX IF NOT EXISTS idx_job_applications_job     ON public.job_applications(job_listing_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant ON public.job_applications(applicant_id);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.update_jobs_board_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_listings_updated_at ON public.job_listings;
CREATE TRIGGER trg_job_listings_updated_at
  BEFORE UPDATE ON public.job_listings FOR EACH ROW
  EXECUTE FUNCTION public.update_jobs_board_timestamp();

DROP TRIGGER IF EXISTS trg_job_applications_updated_at ON public.job_applications;
CREATE TRIGGER trg_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications FOR EACH ROW
  EXECUTE FUNCTION public.update_jobs_board_timestamp();

-- RLS
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active job listings"
  ON public.job_listings FOR SELECT TO authenticated
  USING (is_active = TRUE OR auth.uid() = posted_by);

CREATE POLICY "Alumni and admins can create job listings"
  ON public.job_listings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (account_role IN ('alumni','admin') OR is_admin = TRUE)));

CREATE POLICY "Owner or admin can update job listings"
  ON public.job_listings FOR UPDATE TO authenticated
  USING (auth.uid() = posted_by OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Owner or admin can delete job listings"
  ON public.job_listings FOR DELETE TO authenticated
  USING (auth.uid() = posted_by OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Users can view own applications or their job's applications"
  ON public.job_applications FOR SELECT TO authenticated
  USING (auth.uid() = applicant_id
    OR auth.uid() IN (SELECT posted_by FROM public.job_listings WHERE id = job_listing_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Authenticated users can apply"
  ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Job poster or admin can update application status"
  ON public.job_applications FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT posted_by FROM public.job_listings WHERE id = job_listing_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));
