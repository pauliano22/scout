-- 067: stamp contacted_at/replied_at from status transitions, at the DB layer.
--
-- Every write path (web board, modal dropdown, mobile PATCH, today/approve,
-- agent upserts — and any future one) moves user_networks.status, but only
-- some of them remembered to stamp the timestamps the status implies. The
-- app-layer sites were fixed alongside this migration; the trigger is the
-- catch-all so the reply-rate metrics can never silently go blind again.
--
-- Timestamps are FIRST-TOUCH markers: on UPDATE the STORED value wins over
-- anything the app supplies (so a repeat send / re-mark can never move the
-- clock later), on INSERT an app-supplied value is honored, and nothing is
-- cleared when a status regresses.

create or replace function public.stamp_user_network_status_times()
returns trigger
language plpgsql
as $$
declare
  old_c timestamptz := case when tg_op = 'UPDATE' then old.contacted_at end;
  old_r timestamptz := case when tg_op = 'UPDATE' then old.replied_at end;
begin
  if new.status in ('awaiting_reply', 'response_needed', 'meeting_scheduled', 'met') then
    new.contacted := true;
    new.contacted_at := coalesce(old_c, new.contacted_at, now());
  end if;
  if new.status in ('response_needed', 'meeting_scheduled', 'met') then
    new.replied_at := coalesce(old_r, new.replied_at, now());
  end if;
  return new;
end
$$;

drop trigger if exists trg_stamp_user_network_status_times on public.user_networks;
create trigger trg_stamp_user_network_status_times
  before insert or update of status on public.user_networks
  for each row execute function public.stamp_user_network_status_times();
