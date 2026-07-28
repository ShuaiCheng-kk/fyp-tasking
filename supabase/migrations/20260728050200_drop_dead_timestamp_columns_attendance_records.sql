-- created_at only ever served as a tie-breaker for duplicate rows per shift_assignment_id,
-- which the unique constraint (migration 20260728050100) now makes impossible — nothing else
-- reads it. updated_at was never written by any code path (verified against live data: it was
-- identical to created_at on every row) — a decorative column from table creation that no
-- trigger or application code ever maintained.
alter table public.attendance_records
  drop column if exists created_at,
  drop column if exists updated_at;
