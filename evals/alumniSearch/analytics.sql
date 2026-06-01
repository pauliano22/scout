-- Alumni-search analytics queries.
--
-- The route logs to public.user_events with:
--   event_type = 'alumni_search'
--   event_data = {
--     query        : text,
--     outcome      : 'matches' | 'no_matches' | 'no_candidates' | 'below_floor' | 'clarify',
--     result_count : int,
--     result_ids   : uuid[]
--   }
--
-- All three queries are safe to run as-is from the Supabase SQL editor
-- (RLS will scope to whatever role is connected). Run them as the
-- service-role user when you want global rollup; as a regular user they
-- will only return that user's own events.

-- ============================================================================
-- Q1. Daily search volume + outcome breakdown for the last 30 days.
-- Answers: "Is the flip working? Are we mostly serving matches or no_matches?"
-- ============================================================================
SELECT
  date_trunc('day', created_at)::date           AS day,
  event_data ->> 'outcome'                      AS outcome,
  COUNT(*)                                      AS n
FROM public.user_events
WHERE event_type = 'alumni_search'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

-- ============================================================================
-- Q2. Top 20 no-match queries (last 7 days, anonymized).
-- Answers: "What are people asking for that we can't deliver?"
-- User IDs are intentionally stripped — this is for retrieval-gap analysis,
-- not user lookup. Aggregating by query text shows which phrasings recur.
-- ============================================================================
SELECT
  LOWER(event_data ->> 'query')                 AS query_text,
  COUNT(*)                                      AS times_asked,
  COUNT(DISTINCT user_id)                       AS distinct_users
FROM public.user_events
WHERE event_type = 'alumni_search'
  AND created_at >= NOW() - INTERVAL '7 days'
  AND event_data ->> 'outcome' IN ('no_matches', 'no_candidates', 'below_floor')
  AND event_data ->> 'query' IS NOT NULL
GROUP BY 1
ORDER BY times_asked DESC
LIMIT 20;

-- ============================================================================
-- Q3. Per-user search engagement (last 30 days).
-- Answers: "Are people who try search coming back? What fraction get a
--           useful result on at least one of their queries?"
-- match_rate is the fraction of THAT USER's searches that returned at least
-- one match — the closest thing to per-user satisfaction we can derive from
-- outcome alone, without thumbs-up signal.
-- ============================================================================
WITH per_user AS (
  SELECT
    user_id,
    COUNT(*)                                                    AS total_searches,
    COUNT(*) FILTER (WHERE event_data ->> 'outcome' = 'matches') AS searches_with_matches
  FROM public.user_events
  WHERE event_type = 'alumni_search'
    AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT
  user_id,
  total_searches,
  searches_with_matches,
  ROUND(searches_with_matches::numeric / NULLIF(total_searches, 0), 2) AS match_rate
FROM per_user
ORDER BY total_searches DESC;

-- ============================================================================
-- Bonus (not in spec, but cheap): rollup of Q3 as one row.
-- "What does cohort-level engagement look like?"
-- ============================================================================
WITH per_user AS (
  SELECT
    user_id,
    COUNT(*)                                                    AS total_searches,
    COUNT(*) FILTER (WHERE event_data ->> 'outcome' = 'matches') AS searches_with_matches
  FROM public.user_events
  WHERE event_type = 'alumni_search'
    AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT
  COUNT(*)                                                       AS users_searching,
  ROUND(AVG(total_searches), 1)                                   AS avg_searches_per_user,
  COUNT(*) FILTER (WHERE searches_with_matches > 0)               AS users_with_any_match,
  ROUND(
    COUNT(*) FILTER (WHERE searches_with_matches > 0)::numeric
      / NULLIF(COUNT(*), 0),
    2
  )                                                               AS pct_users_with_any_match
FROM per_user;
