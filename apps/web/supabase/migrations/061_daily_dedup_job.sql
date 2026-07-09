-- Migration 061: Daily dedup job for alumni records
-- (originally authored as 030 on idea/daily-dedup; renumbered — 030 was taken.
--  Ported with two fixes: transfers guard the UNIQUE(user_id, alumni_id[, ...])
--  constraints so a student who saved both copies can't abort the merge, and
--  merged rows are set is_public = false so they drop out of search.)
--
-- Adds columns to track merged records, plus a pair of functions:
--   1. find_duplicate_alumni()      — returns groups of potential duplicates
--   2. merge_alumni_duplicates()    — merges them, keeping the most complete record
--
-- The caller (a scheduled script or cron) orchestrates the workflow: call
-- find_duplicate_alumni(), review the groups, then call merge_alumni_duplicates()
-- to actually merge.

-- =========================================================
-- 1. Tracking columns
-- =========================================================

ALTER TABLE alumni
  ADD COLUMN IF NOT EXISTS is_duplicate    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merged_into_id  uuid REFERENCES alumni(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alumni_is_duplicate
  ON alumni(is_duplicate)
  WHERE is_duplicate = true;

CREATE INDEX IF NOT EXISTS idx_alumni_merged_into
  ON alumni(merged_into_id)
  WHERE merged_into_id IS NOT NULL;

-- =========================================================
-- 2. Helper: count how many non-null columns a row has
-- =========================================================

CREATE OR REPLACE FUNCTION public.alumni_completeness_score(row_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  score integer := 0;
  r     record;
BEGIN
  SELECT * INTO r FROM public.alumni WHERE id = row_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Core identity fields (optional ones that are commonly populated)
  IF r.email          IS NOT NULL AND r.email          != '' THEN score := score + 2; END IF;
  IF r.linkedin_url   IS NOT NULL AND r.linkedin_url   != '' THEN score := score + 2; END IF;
  IF r.full_name      IS NOT NULL AND r.full_name      != '' THEN score := score + 2; END IF;

  -- Career fields
  IF r.company        IS NOT NULL AND r.company        != '' THEN score := score + 2; END IF;
  IF r.role           IS NOT NULL AND r.role           != '' THEN score := score + 2; END IF;
  IF r.industry       IS NOT NULL AND r.industry       != '' THEN score := score + 1; END IF;
  IF r.location       IS NOT NULL AND r.location       != '' THEN score := score + 1; END IF;

  -- Rich/enrichment fields
  IF r.display_headline IS NOT NULL AND r.display_headline != '' THEN score := score + 2; END IF;
  IF r.work_history   IS NOT NULL AND r.work_history   != '[]'::jsonb THEN score := score + 3; END IF;
  IF r.skills         IS NOT NULL AND array_length(r.skills, 1) > 0 THEN score := score + 2; END IF;
  IF r.education      IS NOT NULL AND r.education      != '[]'::jsonb THEN score := score + 2; END IF;
  IF r.bio            IS NOT NULL AND r.bio            != '' THEN score := score + 2; END IF;
  IF r.advice         IS NOT NULL AND r.advice         != '' THEN score := score + 1; END IF;
  IF r.photo_url      IS NOT NULL AND r.photo_url      != '' THEN score := score + 1; END IF;

  -- Claimed / verified rows are preferred
  IF r.is_claimed     = true                              THEN score := score + 3; END IF;
  IF r.is_verified    = true                              THEN score := score + 2; END IF;

  RETURN score;
END;
$$;

-- =========================================================
-- 3. Find duplicate alumni records
-- =========================================================

-- Returns a table of (alumni_id_1, alumni_id_2, match_reason) for manual review.
-- The caller should group by id_1 / id_2 to form merge groups.

CREATE OR REPLACE FUNCTION public.find_duplicate_alumni()
RETURNS TABLE(
  alumni_id_1   uuid,
  alumni_id_2   uuid,
  match_reason  text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- ── Strategy A: Same email (non-null, non-empty) ──────────────────────────
  RETURN QUERY
  SELECT
    a1.id   AS alumni_id_1,
    a2.id   AS alumni_id_2,
    'same_email'::text AS match_reason
  FROM public.alumni a1
  JOIN public.alumni a2 ON a1.email = a2.email
  WHERE a1.id < a2.id
    AND a1.email IS NOT NULL
    AND a1.email != ''
    AND a2.email IS NOT NULL
    AND a2.email != ''
    AND a1.is_duplicate = false
    AND a2.is_duplicate = false;

  -- ── Strategy B: Same full_name + same sport (fuzzy enough for Cornell) ────
  RETURN QUERY
  SELECT
    a1.id   AS alumni_id_1,
    a2.id   AS alumni_id_2,
    'same_name_sport'::text AS match_reason
  FROM public.alumni a1
  JOIN public.alumni a2
    ON lower(trim(a1.full_name)) = lower(trim(a2.full_name))
   AND a1.sport = a2.sport
  WHERE a1.id < a2.id
    AND a1.is_duplicate = false
    AND a2.is_duplicate = false;

  -- ── Strategy C: Similar linkedin_url (last path segment match) ────────────
  RETURN QUERY
  SELECT
    a1.id   AS alumni_id_1,
    a2.id   AS alumni_id_2,
    'similar_linkedin'::text AS match_reason
  FROM public.alumni a1
  JOIN public.alumni a2
    ON lower(nullif(regexp_replace(a1.linkedin_url, '^.*linkedin\.com/(?:in/)?', '', 'g'), ''))
     = lower(nullif(regexp_replace(a2.linkedin_url, '^.*linkedin\.com/(?:in/)?', '', 'g'), ''))
  WHERE a1.id < a2.id
    AND a1.linkedin_url IS NOT NULL AND a1.linkedin_url != ''
    AND a2.linkedin_url IS NOT NULL AND a2.linkedin_url != ''
    AND a1.is_duplicate = false
    AND a2.is_duplicate = false;
END;
$$;

-- =========================================================
-- 4. Merge duplicate alumni records
-- =========================================================

-- Given an array of alumni ids that are duplicates, keep the one with the
-- highest completeness score, transfer all FK references to it, then mark
-- the other rows as duplicates.

CREATE OR REPLACE FUNCTION public.merge_alumni_duplicates(group_ids uuid[])
RETURNS TABLE(
  canonical_id     uuid,
  merged_ids       uuid[],
  records_merged   integer
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_canonical  uuid;
  v_count      integer := 0;
  v_id         uuid;
  v_score      integer;
  v_best_score integer := -1;
BEGIN
  -- Bail if fewer than 2 ids
  IF cardinality(group_ids) < 2 THEN
    RETURN;
  END IF;

  -- Find the best record in the group (highest completeness score)
  FOREACH v_id IN ARRAY group_ids
  LOOP
    SELECT public.alumni_completeness_score(v_id) INTO v_score;
    IF v_score > v_best_score THEN
      v_best_score := v_score;
      v_canonical  := v_id;
    END IF;
  END LOOP;

  -- Update FK references from all non-canonical records to point to canonical
  FOREACH v_id IN ARRAY group_ids
  LOOP
    CONTINUE WHEN v_id = v_canonical;

    -- profiles (ON DELETE SET NULL → safe to update)
    UPDATE public.profiles
      SET alumni_id = v_canonical
      WHERE alumni_id = v_id;

    -- user_networks (ON DELETE CASCADE → must transfer)
    -- Guard UNIQUE: if a row already points at the canonical record for the
    -- same owner, drop the duplicate-pointing row instead of colliding.
    DELETE FROM public.user_networks d
      WHERE d.alumni_id = v_id
        AND EXISTS (
          SELECT 1 FROM public.user_networks k
          WHERE k.user_id = d.user_id AND k.alumni_id = v_canonical
        );
    UPDATE public.user_networks
      SET alumni_id = v_canonical
      WHERE alumni_id = v_id;

    -- messages (ON DELETE CASCADE → must transfer)
    UPDATE public.messages
      SET alumni_id = v_canonical
      WHERE alumni_id = v_id;

    -- suggested_actions (ON DELETE SET NULL → safe to update)
    UPDATE public.suggested_actions
      SET alumni_id = v_canonical
      WHERE alumni_id = v_id;

    -- plan_alumni (ON DELETE CASCADE → must transfer)
    UPDATE public.plan_alumni
      SET alumni_id = v_canonical
      WHERE alumni_id = v_id;

    -- agent_action_queue (ON DELETE CASCADE → must transfer)
    -- Guard UNIQUE: if a row already points at the canonical record for the
    -- same owner, drop the duplicate-pointing row instead of colliding.
    DELETE FROM public.agent_action_queue d
      WHERE d.alumni_id = v_id
        AND EXISTS (
          SELECT 1 FROM public.agent_action_queue k
          WHERE k.user_id = d.user_id AND k.alumni_id = v_canonical AND k.action_type = d.action_type
        );
    UPDATE public.agent_action_queue
      SET alumni_id = v_canonical
      WHERE alumni_id = v_id;

    -- alumni_outreach_ledger (ON DELETE CASCADE → must transfer)
    -- Guard UNIQUE: if a row already points at the canonical record for the
    -- same owner, drop the duplicate-pointing row instead of colliding.
    DELETE FROM public.alumni_outreach_ledger d
      WHERE d.alumni_id = v_id
        AND EXISTS (
          SELECT 1 FROM public.alumni_outreach_ledger k
          WHERE k.user_id = d.user_id AND k.alumni_id = v_canonical
        );
    UPDATE public.alumni_outreach_ledger
      SET alumni_id = v_canonical
      WHERE alumni_id = v_id;

    -- outreach_queue (ON DELETE CASCADE → must transfer)
    -- Guard UNIQUE: if a row already points at the canonical record for the
    -- same owner, drop the duplicate-pointing row instead of colliding.
    DELETE FROM public.outreach_queue d
      WHERE d.alumni_id = v_id
        AND EXISTS (
          SELECT 1 FROM public.outreach_queue k
          WHERE k.user_id = d.user_id AND k.alumni_id = v_canonical AND k.message_type = d.message_type
        );
    UPDATE public.outreach_queue
      SET alumni_id = v_canonical
      WHERE alumni_id = v_id;

    -- alumni_swipes (ON DELETE CASCADE → must transfer)
    -- Guard UNIQUE: if a row already points at the canonical record for the
    -- same owner, drop the duplicate-pointing row instead of colliding.
    DELETE FROM public.alumni_swipes d
      WHERE d.alumni_id = v_id
        AND EXISTS (
          SELECT 1 FROM public.alumni_swipes k
          WHERE k.user_id = d.user_id AND k.alumni_id = v_canonical
        );
    UPDATE public.alumni_swipes
      SET alumni_id = v_canonical
      WHERE alumni_id = v_id;

    -- Mark the record as a duplicate
    UPDATE public.alumni
      SET
        is_duplicate   = true,
        merged_into_id = v_canonical,
        is_public      = false,
        updated_at     = now()
      WHERE id = v_id;

    v_count := v_count + 1;
  END LOOP;

  -- Update the canonical record's timestamp
  UPDATE public.alumni
    SET updated_at = now()
    WHERE id = v_canonical;

  -- Return result
  canonical_id   := v_canonical;
  merged_ids     := array_remove(group_ids, v_canonical);
  records_merged := v_count;
  RETURN NEXT;
END;
$$;

-- =========================================================
-- 5. Bulk merge: convenience wrapper that finds all duplicates
--    and merges each group automatically
-- =========================================================

CREATE OR REPLACE FUNCTION public.dedup_alumni_auto()
RETURNS TABLE(
  canonical_id     uuid,
  merged_ids       uuid[],
  records_merged   integer,
  match_reason     text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_group     uuid[];
  v_row       record;
BEGIN
  FOR v_row IN SELECT * FROM public.find_duplicate_alumni()
  LOOP
    v_group := ARRAY[v_row.alumni_id_1, v_row.alumni_id_2];

    RETURN QUERY
    SELECT
      m.canonical_id,
      m.merged_ids,
      m.records_merged,
      v_row.match_reason
    FROM public.merge_alumni_duplicates(v_group) m;
  END LOOP;
END;
$$;
