-- Leave/Time-Off requests (Settings page "Leave Requests" panel, time_off/break_waiver) are
-- confirmed cut — the only leave-type mechanism going forward is Off Day Request
-- (employee_fixed_off_days / off_day_requests). Drop the now-unused table entirely.
drop table if exists public.time_off_requests;
