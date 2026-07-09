-- Migration 052: gate alumni-directory reads, and enforce the student email
-- domain server-side at signup.
--
-- WHY
-- The only read policy on `alumni` was `FOR SELECT TO authenticated USING
-- (is_public = true)`, so ANY authenticated user (incl. a burner "alumni" signup)
-- could page the entire ~17k directory via PostgREST. This closes that.
--
-- MODEL
-- Directory browsing is granted only to Cornell-affiliated callers:
--   * @cornell.edu accounts (students), OR
--   * a profile flagged `directory_access = true` (an admin, or an alum whose
--     claim has been accepted — see the claim flow + admin review).
-- Alumni get `directory_access` when their profile claim is accepted: a claim
-- whose name matches the roster is auto-accepted; an unmatched name is held for
-- admin review (migration 055 + /api/alumni/claim + /admin/claims).
-- Alumni keep full control of their OWN row regardless (policies c + d below),
-- so claiming / editing works even before access is granted.
-- Service-role (server) reads bypass RLS and are unaffected.

BEGIN;

-- Browse-access flag. Students are granted via the @cornell.edu check, so this
-- is really the alumni/admin switch.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS directory_access boolean NOT NULL DEFAULT false;

-- Preserve access for people who already legitimately have it, so this migration
-- doesn't lock out existing users.
UPDATE public.profiles
  SET directory_access = true
  WHERE directory_access = false
    AND (alumni_id IS NOT NULL OR is_verified = true OR account_role = 'admin'::public.user_role);

-- ============================================================
-- Directory read policies
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view public alumni" ON public.alumni;

-- (a) Browse the public directory — Cornell students + access-granted profiles.
CREATE POLICY "Approved users can view public alumni" ON public.alumni
  FOR SELECT TO authenticated
  USING (
    is_public = true
    AND (
      lower(coalesce(auth.email(), '')) LIKE '%@cornell.edu'
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.directory_access = true
               OR p.account_role = 'admin'::public.user_role)
      )
    )
  );

-- (c) An alum can always read their OWN claimed row (any email, even if hidden
--     while pending review).
CREATE POLICY "Alumni can view own claimed row" ON public.alumni
  FOR SELECT TO authenticated
  USING (claimed_by_user_id = auth.uid());

-- (d) Pre-claim discovery: read the alumni row matching your own email.
CREATE POLICY "Users can view alumni row matching their own email" ON public.alumni
  FOR SELECT TO authenticated
  USING (
    email IS NOT NULL
    AND lower(email) = lower(coalesce(auth.email(), '__none__'))
  );

-- ============================================================
-- Signup: enforce the student email domain server-side
-- ============================================================
-- Mirrors the client check in app/signup/page.tsx so a direct supabase.auth
-- .signUp() call can't bypass it. Students must use @cornell.edu; alumni any
-- email. (Alumni directory access is decided later, at claim time.)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_raw text;
  v_role text := 'student';
  v_account_role public.user_role := 'student';
BEGIN
  BEGIN
    v_raw := lower(coalesce(NEW.raw_user_meta_data->>'account_role', 'student'));
    IF v_raw IN ('student', 'alumni') THEN v_role := v_raw; END IF;
    v_account_role := v_role::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'student'; v_account_role := 'student'::public.user_role;
  END;

  IF v_role = 'student'
     AND lower(coalesce(NEW.email, '')) NOT LIKE '%@cornell.edu' THEN
    RAISE EXCEPTION 'Student accounts require a @cornell.edu email address';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, email, full_name, account_role, is_alumni)
    VALUES (
      NEW.id, NEW.email,
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
