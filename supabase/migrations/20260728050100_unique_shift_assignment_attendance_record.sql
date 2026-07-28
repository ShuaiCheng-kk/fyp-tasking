-- Enforce at the database level what the application already assumes: one attendance record
-- per shift assignment (clockIn always checks for an existing record before creating a new
-- one). This removes the need for the created_at-ordered "most recent wins" tie-breaker that
-- getAttendanceRecordByAssignmentId used as a defensive fallback against duplicate rows.
alter table public.attendance_records
  add constraint attendance_records_shift_assignment_id_key unique (shift_assignment_id);
