-- Migration 019: Make handle_new_user() resilient.
--
-- Migration 018's version of handle_new_user() casts the metadata role string
-- to the user_role enum directly. If the metadata is malformed, missing the
-- expected key, or carries an unexpected role value, the cast raises and
-- Supabase Auth surfaces it as "Database error saving new user", blocking
-- signup entirely. This version catches every error path and falls back to
-- a sensible default ('student') so signup always succeeds. The downstream
-- claim wizard can still upgrade the role when needed.
--
-- We also (1) idempotently ensure the user_role enum exists, in case mig 017
-- was missed or partially rolled back on this database, and (2) fully-qualify
-- type references as `public.user_role` so SECURITY DEFINER's search_path
-- can't shadow them.

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('student', 'alumni', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_raw text;
  v_role text := 'student';
  v_account_role public.user_role := 'student';
BEGIN
  -- Defensively read metadata. Any failure here falls through to defaults.
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

  -- Insert the profile. If anything goes wrong, log and re-raise so we know,
  -- but only after the role logic has been bullet-proofed above.
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
    -- Re-raise so Supabase Auth still knows it failed.
    RAISE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists from migrations 001/018; recreate to be safe.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
