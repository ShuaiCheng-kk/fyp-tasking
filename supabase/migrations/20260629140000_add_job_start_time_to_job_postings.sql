-- One-off Job postings previously had no time-of-day field at all (job_date/job_end_date are
-- date-only, estimated_hours is free text) — UC49's Casual Worker Clock In gating needs a real
-- start time to compare against, just like Shift Jobs already have via shift_start_time.
alter table public.job_postings
  add column if not exists job_start_time time;
