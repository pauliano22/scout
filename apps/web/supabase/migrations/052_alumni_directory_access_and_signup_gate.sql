-- Migration 052: Restrict alumni-directory reads to Cornell-affiliated users,
-- and enforce the student email domain server-side at signup.
--
-- WHY
-- Before this migration the only read policy on `alumni` was:
--     FOR SELECT TO authenticated USING (is_public = true)
-- so ANY authenticated user could read every public alumni row directly through
-- PostgREST (…/rest/v1/alumni?select=*&limit=1000&offset=…), i.e. page through
-- all ~17k names / emails / employers / LinkedIn URLs. The @cornell.edu check on
-- the signup page is client-side only, so an attacker could call
-- supabase.auth.signUp() directly (or sign up as "alumni", which accepts any
-- email) and then scrape the whole directory. This is the #1 privacy risk in the
-- July 2026 audit.
--
-- AFTER
-- The public directory is readable only by Cornell-affiliated callers:
--   (a) an @cornell.edu account (the student-athletes the app is built for), or
--   (b) a verified profile, an admin, or a user who has claimed an alumni profile.
-- Alumni on non-Cornell emails keep full control of their OWN data:
--   (c) they can read their own claimed row, and
--   (d) they can find the row that matches their email (needed to claim it).
-- Service-role (server) reads bypass RLS and are unaffected, so admin tooling,
-- the picks/agent engines, search, and cron keep working.
--
-- POLICY NOTE (confirm before shipping): this intentionally stops non-Cornell
-- "alumni" accounts from browsing the full directory. If you decide alumni
-- should also browse, add `OR p.account_role = 'alumni'` to policy (a) — but be
-- aware that reopens bulk reads to anyone who signs up as alumni with any email.
--
-- STILL TODO (needs the app running to verify safely, not in this migration):
--   * Column minimization: stop returning `alumni.email` to the client except
--     where share_email_with_students = true (best done via a view or a server
--     endpoint; a blunt column REVOKE would break the claim flow + email sharing).
--   * Per-user rate limiting on directory reads (Redis; scaffolding exists in
--     lib/redis.ts) so even a legit student can't bulk-harvest.
--
-- REVERSIBLE: drop the three policies below and recreate the original
-- "Authenticated users can view public alumni" policy; the trigger change is a
-- CREATE OR REPLACE that can be restored from migration 019.

BEGIN;

-- ============================================================
-- 1. Alumni directory read policies
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view public alumni" ON public.alumni;

-- (a)+(b) Browse the public directory — Cornell-affiliated callers only.
CREATE POLICY "Cornell-affiliated users can view public alumni" ON public.alumni
  FOR SELECT TO authenticated
  USING (
    is_public = true
    AND (
      lower(coalesce(auth.email(), '')) LIKE '%@cornell.edu'
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (
            p.is_verified = true
            OR p.account_role = 'admin'::public.user_role
            OR p.alumni_id IS NOT NULL          -- has claimed an alumni profile
          )
      )
    )
  );

-- (c) An alum can always read their OWN claimed row, regardless of email domain.
CREATE POLICY "Alumni can view own claimed row" ON public.alumni
  FOR SELECT TO authenticated
  USING (claimed_by_user_id = auth.uid());

-- (d) Pre-claim discovery: a user can read the alumni row matching their email
--     (this is how the claim wizard finds the row to claim — ProfileClient.tsx
--     queries alumni by email). Scoped to an exact email match, so it exposes at
--     most the caller's own record.
CREATE POLICY "Users can view alumni row matching their own email" ON public.alumni
  FOR SELECT TO authenticated
  USING (
    email IS NOT NULL
    AND lower(email) = lower(coalesce(auth.email(), '__none__'))
  );

-- ============================================================
-- 2. Signup: enforce the student email domain server-side
-- ============================================================
-- Mirrors the client-side check in app/signup/page.tsx so it can't be bypassed
-- by calling supabase.auth.signUp() directly. Students must use @cornell.edu;
-- alumni may use any email. Based on migration 019's resilient version.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_raw text;
  v_role text := 'student';
  v_account_role public.user_role := 'student';
BEGIN
  -- Defensively read the role from signup metadata; any failure falls back to
  -- 'student' (matches 019's behavior).
  BEGIN
    v_raw := lower(coalesce(NEW.raw_user_meta_data->>'account_role', 'student'));
    IF v_raw IN ('student', 'alumni') THEN
      v_role := v_raw;
    END IF;
    v_account_role := v_role::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'student';
    v_account_role := 'student'::public.user_role;
  END;

  -- Enforce the student email domain. Alumni may use any email.
  IF v_role = 'student'
     AND lower(coalesce(NEW.email, '')) NOT LIKE '%@cornell.edu' THEN
    RAISE EXCEPTION 'Student accounts require a @cornell.edu email address';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, email, full_name, account_role, is_alumni)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      v_account_role,
      v_account_role = 'alumni'::public.user_role
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profile insert failed for %: %', NEW.email, SQLERRM;
    RAISE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
