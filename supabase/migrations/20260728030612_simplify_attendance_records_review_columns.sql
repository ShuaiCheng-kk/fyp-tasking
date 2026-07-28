-- attendance_records had accumulated columns from a multi-tier approval flow that was cut
-- (see CLAUDE.md: attendance has no approval chain) and from a break-time edit path that never
-- got the same "adjusted copy" treatment as clock times. This migration:
--   1. Renames columns whose names no longer match what they hold or do.
--   2. Adds adjusted_break_in_time/adjusted_break_out_time so break edits work exactly like
--      clock edits (raw column stays the true original forever; the correction goes to its own
--      adjusted_* column) — this makes owner_modified_original_values unnecessary, since the
--      true original is always recoverable by reading the raw column directly.
--   3. Drops columns that are either dead (no UI ever reads/writes them — the old multi-tier
--      manager-review step, the AI timesheet approval path, notes/reason fields no UI collects)
--      or now fully derivable from comparing each raw column to its adjusted_* counterpart
--      (owner_status, owner_modified_fields, owner_modified_original_values).

alter table public.attendance_records
  rename column casual_worker_id to user_id;

alter table public.attendance_records
  rename column owner_notes to modified_reason;

alter table public.attendance_records
  rename column owner_reviewed_by to modified_by;

alter table public.attendance_records
  rename column owner_reviewed_at to modified_at;

alter table public.attendance_records
  rename column owner_adjusted_clock_in_time to adjusted_clock_in_time;

alter table public.attendance_records
  rename column owner_adjusted_clock_out_time to adjusted_clock_out_time;

alter table public.attendance_records
  add column if not exists adjusted_break_in_time timestamptz,
  add column if not exists adjusted_break_out_time timestamptz;

alter table public.attendance_records
  drop column if exists confirmed_by_employee_id,
  drop column if exists submitted_by_employee_id,
  drop column if exists status,
  drop column if exists employee_notes,
  drop column if exists manager_notes,
  drop column if exists owner_status,
  drop column if exists late_reason,
  drop column if exists absence_reason,
  drop column if exists attachment_url,
  drop column if exists owner_modified_fields,
  drop column if exists owner_modified_original_values;

comment on column public.attendance_records.user_id is
  'Whoever clocked in for this record — Employee, Manager, or Casual Worker (all three self-clock the same way). Name kept short; not Casual-Worker-exclusive despite the table''s history.';
comment on column public.attendance_records.adjusted_clock_in_time is
  'Corrected clock-in time if a reviewer edited it; clock_in_time itself is never overwritten, so it always holds the true original.';
comment on column public.attendance_records.adjusted_clock_out_time is
  'Corrected clock-out time if a reviewer edited it; clock_out_time itself is never overwritten, so it always holds the true original.';
comment on column public.attendance_records.adjusted_break_in_time is
  'Corrected break-in time if a reviewer edited it; break_in_time itself is never overwritten, so it always holds the true original.';
comment on column public.attendance_records.adjusted_break_out_time is
  'Corrected break-out time if a reviewer edited it; break_out_time itself is never overwritten, so it always holds the true original.';
comment on column public.attendance_records.modified_reason is
  'Reason given when a reviewer corrects a time. Required whenever any adjusted_* value ends up differing from its raw counterpart.';
comment on column public.attendance_records.modified_by is
  'Who last corrected this record''s times — Owner, Partner, or a Manager (scoped to their own department''s Employee/Casual Worker records).';
comment on column public.attendance_records.modified_at is
  'When modified_by last corrected this record''s times.';
