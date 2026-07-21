-- 068: two diagnostic steps for the signup funnel.
--
-- The 2026-07-20 funnel forensics showed the zone between "page loaded" and
-- "validated submit" is completely dark: client-side validation failures
-- (cornell-email gate, consent checkbox, native required) emit nothing, so an
-- ad-tap bounce is indistinguishable from a person actively blocked mid-form.
--
--   form_engaged   — first focus on any form field (real engagement, vs the
--                    'form' step which fires on mount for ?role= deep links)
--   submit_blocked — a submit attempt rejected before the 'submit' step, with
--                    metadata.reason: role_missing | cornell_email |
--                    terms_unchecked | native_validation | auth_error

alter table public.signup_events
  drop constraint if exists signup_events_step_check;
alter table public.signup_events
  add constraint signup_events_step_check
  check (step in ('landing', 'form', 'form_engaged', 'submit_blocked', 'submit', 'verify', 'complete'));
