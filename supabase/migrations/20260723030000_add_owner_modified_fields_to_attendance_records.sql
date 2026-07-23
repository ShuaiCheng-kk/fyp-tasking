-- Tracks which specific time field(s) the last 'modified' decision actually changed (a subset of
-- clock_in_time/clock_out_time/break_in_time/break_out_time), so the Owner/Partner attendance page
-- can show what a Manager's correction touched without re-deriving it from before/after snapshots.
-- Combined with the existing owner_reviewed_by/owner_reviewed_at, this is enough to answer "who
-- modified this record and what did they change" — no separate audit table needed.
alter table public.attendance_records
  add column if not exists owner_modified_fields text[];
