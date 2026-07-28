-- clock_out_released_by was write-only (never read anywhere) and always equal to the record's
-- own shift_assignments.supervisor_employee_id anyway, since only that supervisor is ever
-- allowed to release a clock-out — dropping it loses no information.
-- clock_out_released_at was only ever read as a null-check (a release gate for one-off/
-- open-ended jobs), never displayed or used as an actual timestamp — a boolean says the same
-- thing more honestly.

alter table public.attendance_records
  drop column if exists clock_out_released_by;

alter table public.attendance_records
  add column if not exists clock_out_released boolean not null default false;

update public.attendance_records
  set clock_out_released = true
  where clock_out_released_at is not null;

alter table public.attendance_records
  drop column if exists clock_out_released_at;

comment on column public.attendance_records.clock_out_released is
  'Open-ended (one-off) jobs have no scheduled end time, so the supervising Employee must review the work and set this true before the Casual Worker is allowed to clock out. Unused for fixed-end shifts, which keep the time-based gate instead.';
