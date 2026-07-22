-- Casual Workers only get shift/location/supervisor details once, at offer-confirmation time
-- (sendOfferConfirmedEmail). A daily Vercel Cron re-sends the same details the day before the
-- shift so they aren't buried in an old inbox by the time the worker needs them. Tracked
-- per-shift, not per-assignment: a shift born from a confirmed offer normally has exactly one
-- assigned worker. Known accepted limitation: a second worker later added to an
-- already-reminded shift won't get their own reminder.
alter table public.shifts
  add column if not exists reminder_sent_at timestamptz;
