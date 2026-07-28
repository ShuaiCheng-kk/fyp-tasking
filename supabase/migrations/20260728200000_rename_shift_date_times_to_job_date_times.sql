-- shift_date/shift_start_time/shift_end_time are no longer shift-exclusive — shift_date is used
-- by both Shift and One-off postings, and shift_start_time now also carries a One-off job's start
-- time (job_start_time was merged into it earlier). Rename to the neutral job_* prefix so the
-- column names match what they actually hold across both job types.
alter table public.job_postings rename column shift_date to job_date;
alter table public.job_postings rename column shift_start_time to job_start_time;
alter table public.job_postings rename column shift_end_time to job_end_time;
