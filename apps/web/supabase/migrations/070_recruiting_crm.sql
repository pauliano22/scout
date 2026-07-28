-- 070: recruiting CRM — deliberate onboarding of current student-athletes.
--
-- The prospect universe is NOT stored here: it is composed live from the
-- alumni table (graduation_year >= computed cutoff, not duplicate, not
-- suppressed), so the roster never drifts. These tables hold only the CRM
-- state a human creates: statuses, notes, outreach activities, match
-- confirmations, and per-team campaign state. A prospect row is created
-- lazily on first touch — untouched athletes cost zero bookkeeping.
--
-- status holds MANUAL stages only. signed_up/activated are derived at read
-- time from profiles/user_events and are deliberately not storable, so the
-- CRM can never claim a signup the product hasn't seen.
--
-- kind has NO email option on purpose: scraped contact data is never an
-- outreach path (compliance pack 07-LEGAL §6). Instagram handles are
-- hand-collected fresh — no such column exists anywhere else.

CREATE TABLE IF NOT EXISTS public.recruiting_prospects (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumni_id            uuid NOT NULL UNIQUE REFERENCES public.alumni(id) ON DELETE CASCADE,
  status               text NOT NULL DEFAULT 'untouched'
                         CHECK (status IN ('untouched','targeted','reached_out','responded','not_now')),
  is_captain           boolean NOT NULL DEFAULT false,
  instagram_handle     text,
  notes                text,
  next_action          text,
  next_action_due      date,
  -- First-touch stamps, written only by the trigger below (067 pattern).
  reached_out_at       timestamptz,
  responded_at         timestamptz,
  -- A stored link is HUMAN-CONFIRMED; auto matches are computed at read time.
  matched_profile_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  matched_at           timestamptz,
  rejected_profile_ids uuid[] NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruiting_prospects_status
  ON public.recruiting_prospects (status);
CREATE INDEX IF NOT EXISTS idx_recruiting_prospects_next_action_due
  ON public.recruiting_prospects (next_action_due) WHERE next_action_due IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recruiting_prospects_matched_profile
  ON public.recruiting_prospects (matched_profile_id);

CREATE TABLE IF NOT EXISTS public.recruiting_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.recruiting_prospects(id) ON DELETE CASCADE,
  kind        text NOT NULL
                CHECK (kind IN ('ig_dm','in_person','teammate_intro','captain_intro','event','other')),
  outcome     text
                CHECK (outcome IN ('no_reply','replied_positive','replied_negative','agreed_to_join','met')),
  body        text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruiting_activities_prospect
  ON public.recruiting_activities (prospect_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.recruiting_teams (
  team_key       text PRIMARY KEY,
  is_focus       boolean NOT NULL DEFAULT false,
  strategy_notes text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- First-touch stamps from status transitions (exact 067 pattern): stored
-- value always wins on UPDATE, app-supplied honored on INSERT, nothing is
-- cleared when a status regresses.
create or replace function public.stamp_recruiting_status_times()
returns trigger
language plpgsql
as $$
declare
  old_ro timestamptz := case when tg_op = 'UPDATE' then old.reached_out_at end;
  old_re timestamptz := case when tg_op = 'UPDATE' then old.responded_at end;
begin
  if new.status in ('reached_out', 'responded', 'not_now') then
    new.reached_out_at := coalesce(old_ro, new.reached_out_at, now());
  end if;
  if new.status = 'responded' then
    new.responded_at := coalesce(old_re, new.responded_at, now());
  end if;
  return new;
end
$$;

DROP TRIGGER IF EXISTS trg_stamp_recruiting_status_times ON public.recruiting_prospects;
CREATE TRIGGER trg_stamp_recruiting_status_times
  BEFORE INSERT OR UPDATE OF status ON public.recruiting_prospects
  FOR EACH ROW EXECUTE FUNCTION public.stamp_recruiting_status_times();

DROP TRIGGER IF EXISTS update_recruiting_prospects_updated_at ON public.recruiting_prospects;
CREATE TRIGGER update_recruiting_prospects_updated_at
  BEFORE UPDATE ON public.recruiting_prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_recruiting_teams_updated_at ON public.recruiting_teams;
CREATE TRIGGER update_recruiting_teams_updated_at
  BEFORE UPDATE ON public.recruiting_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Service-role-only access (065 pattern): every path goes through
-- requireAdmin() route handlers with the service client.
ALTER TABLE public.recruiting_prospects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiting_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiting_teams      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages recruiting prospects" ON public.recruiting_prospects;
CREATE POLICY "Service role manages recruiting prospects"
  ON public.recruiting_prospects FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages recruiting activities" ON public.recruiting_activities;
CREATE POLICY "Service role manages recruiting activities"
  ON public.recruiting_activities FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages recruiting teams" ON public.recruiting_teams;
CREATE POLICY "Service role manages recruiting teams"
  ON public.recruiting_teams FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
