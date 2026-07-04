-- Owner's two decisions on a Fixed Off Day request are now "approve" or "modify" (reassign the
-- requester's day(s) to different dates in the same week, e.g. after an AI/staffing check flags
-- the originally requested day as already full) — 'rejected' stays a valid historical/legacy value
-- but is no longer offered as a live Owner action.
alter table public.employee_off_day_requests
  drop constraint employee_off_day_requests_status_check;

alter table public.employee_off_day_requests
  add constraint employee_off_day_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'modified'));
