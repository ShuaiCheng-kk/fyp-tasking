-- UC49: a shift generated from a One-off Job posting has no real end time — the worker decides
-- when the task is done (pay is flat-rate regardless of duration). end_time is still populated
-- with a structural placeholder (job_start_time + 1 hour) so the NOT NULL constraint holds, but
-- is_open_ended lets Clock Out skip the "only at/after end_time" gate that applies to shifts
-- with a real scheduled end (Manager/Employee shifts, and Casual Worker Shift Job assignments).
alter table public.shifts
  add column if not exists is_open_ended boolean not null default false;
