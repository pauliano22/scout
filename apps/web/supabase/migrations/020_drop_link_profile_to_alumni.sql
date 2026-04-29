-- Migration 020: Drop the legacy link_profile_to_alumni trigger.
--
-- Migration 012 added a BEFORE INSERT trigger on profiles that auto-linked a
-- new profile to a matching alumni row by email. The new alumni claim wizard
-- (mig 018, /api/alumni/claim) does this explicitly and gives the user
-- control, so the auto-linker is redundant.
--
-- It also breaks signup in some Supabase setups: the trigger function runs
-- under SECURITY DEFINER without `public` on its search_path, so the
-- unqualified `FROM alumni` reference raises "relation alumni does not
-- exist" — which Supabase Auth surfaces as "Database error saving new user".

DROP TRIGGER IF EXISTS trigger_link_profile_to_alumni ON profiles;
DROP FUNCTION IF EXISTS link_profile_to_alumni();
