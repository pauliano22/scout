-- IDEA 47: Alumni-to-Student Mentorship Matching with Capacity Signals
-- Adds a mentorship table for alumni to signal availability and capacity.

CREATE TABLE IF NOT EXISTS public.mentorship (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  alumni_id       uuid REFERENCES public.alumni(id) ON DELETE CASCADE NOT NULL UNIQUE,
  accepting_mentees boolean DEFAULT false NOT NULL,
  capacity        int NOT NULL DEFAULT 1 CHECK (capacity >= 1 AND capacity <= 5),
  spots_filled    int NOT NULL DEFAULT 0 CHECK (spots_filled >= 0 AND spots_filled <= capacity),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_accepting
  ON public.mentorship (accepting_mentees DESC, (capacity - spots_filled) DESC)
  WHERE accepting_mentees = true;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.update_mentorship_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mentorship_updated_at ON public.mentorship;
CREATE TRIGGER mentorship_updated_at
  BEFORE UPDATE ON public.mentorship
  FOR EACH ROW EXECUTE FUNCTION public.update_mentorship_timestamp();

ALTER TABLE public.mentorship ENABLE ROW LEVEL SECURITY;

-- Alumni can read their own mentorship settings
CREATE POLICY "Alumni read own mentorship" ON public.mentorship
  FOR SELECT USING (
    alumni_id IN (
      SELECT alumni_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Alumni can upsert their own mentorship settings
CREATE POLICY "Alumni upsert own mentorship" ON public.mentorship
  FOR INSERT WITH CHECK (
    alumni_id IN (
      SELECT alumni_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Alumni update own mentorship" ON public.mentorship
  FOR UPDATE USING (
    alumni_id IN (
      SELECT alumni_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Students (authenticated users) can read mentorship status of all alumni
CREATE POLICY "Students read all mentorship" ON public.mentorship
  FOR SELECT USING (true);
