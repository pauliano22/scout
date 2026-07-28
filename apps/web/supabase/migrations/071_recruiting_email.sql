-- 071: recruiting email channel.
--
-- contact_email is HAND-COLLECTED contact data (founder's own team sheets and
-- past invite lists — provenance: Ian's ibw22 sent mail + Drive rosters),
-- kept deliberately separate from the scraped alumni.email column, which
-- remains barred from outreach. The activity kind gains 'email' accordingly.
--
-- email_suppression is the do-not-email list checked by EVERY send path
-- (recruiting sends and campaign sends alike) before any message goes out —
-- CAN-SPAM requires opt-outs honored; this makes it code-enforced.

ALTER TABLE public.recruiting_prospects
  ADD COLUMN IF NOT EXISTS contact_email text;

ALTER TABLE public.recruiting_activities
  DROP CONSTRAINT IF EXISTS recruiting_activities_kind_check;
ALTER TABLE public.recruiting_activities
  ADD CONSTRAINT recruiting_activities_kind_check
  CHECK (kind IN ('ig_dm','in_person','teammate_intro','captain_intro','event','email','other'));

CREATE TABLE IF NOT EXISTS public.email_suppression (
  email      text PRIMARY KEY,
  reason     text NOT NULL DEFAULT 'unsubscribe'
               CHECK (reason IN ('unsubscribe','bounce','complaint','manual')),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_suppression ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages email suppression" ON public.email_suppression;
CREATE POLICY "Service role manages email suppression"
  ON public.email_suppression FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
