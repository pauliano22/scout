-- Migration 056: why is this alum in the directory — seeking employment, or
-- here to help students?
--
-- Adds alumni.engagement_intent so a claimed alum can declare whether they're
-- job-hunting themselves, offering help (intros, advice, mentorship), or both.
-- Lets the directory/matching treat the two very differently: a job-seeking
-- alum shouldn't be pitched as a warm intro target, and a helper shouldn't be
-- shown job leads. NULL = unknown (the default for scraped rows that have
-- never claimed their profile — most of the directory).
--
-- Distinct from the mentorship table (041), which is capacity for a specific
-- program; this is the top-level "what am I here for" signal set at claim /
-- profile-edit time.

BEGIN;

ALTER TABLE public.alumni
  ADD COLUMN IF NOT EXISTS engagement_intent text
  CHECK (engagement_intent IN ('seeking_employment', 'here_to_help', 'both'));

COMMENT ON COLUMN public.alumni.engagement_intent IS
  'Why the alum is in the directory: seeking_employment, here_to_help, or both. '
  'NULL = unknown (unclaimed / scraped rows). Set via claim + profile edit.';

-- Filterable both ways ("who can help" and "who is looking"); partial index
-- keeps it tiny since almost all rows are NULL.
CREATE INDEX IF NOT EXISTS idx_alumni_engagement_intent
  ON public.alumni(engagement_intent) WHERE engagement_intent IS NOT NULL;

COMMIT;
