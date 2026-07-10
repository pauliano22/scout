-- Migration 062: at most one ACTIVE networking plan per user.
--
-- The daily-picks day-claim uses networking_plans.last_sourced_at as a
-- per-user mutex. Nothing enforced a single active plan: three separate
-- read-then-insert creators (dailyPicks self-heal, ensureAgentState,
-- applyCampaignGoal) could race on concurrent first loads, and a second
-- active plan is a second mutex — its null stamp wins the claim on every
-- load, voiding the cap and the one-mint-per-day rule (2026-07-10 audit,
-- confirmed breaks-picks). Code-side read errors are now fatal instead of
-- falling into insert branches; this index makes the race itself impossible.
--
-- Verified before shipping: prod has zero users with more than one active
-- plan, so this creates cleanly.

CREATE UNIQUE INDEX IF NOT EXISTS one_active_plan_per_user
  ON public.networking_plans (user_id)
  WHERE is_active;
