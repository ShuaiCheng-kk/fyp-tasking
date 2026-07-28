-- Standardize on the modified_* prefix (matching modified_by/modified_at/modified_reason)
-- across every column a reviewer's correction touches, instead of mixing adjusted_* and
-- modified_* for the same concept.

alter table public.attendance_records
  rename column adjusted_clock_in_time to modified_clock_in_time;

alter table public.attendance_records
  rename column adjusted_clock_out_time to modified_clock_out_time;

alter table public.attendance_records
  rename column adjusted_break_in_time to modified_break_in_time;

alter table public.attendance_records
  rename column adjusted_break_out_time to modified_break_out_time;
