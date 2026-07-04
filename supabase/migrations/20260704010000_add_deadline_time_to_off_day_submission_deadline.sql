-- Adds a time-of-day to the weekly submission deadline, so "Friday" becomes "Friday 5:00 PM"
-- instead of implicitly meaning "end of day". Stored as 24h "HH:MM" text, matching the
-- shifts.start_time/end_time convention used throughout the app.
alter table public.off_day_submission_deadline
  add column deadline_time text not null default '17:00'
  check (deadline_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
