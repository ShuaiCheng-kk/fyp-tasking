-- UC57/58 (Submit/Approve Leave Request): time_off_requests.request_type only allowed
-- 'time_off' / 'break_waiver' at the DB level, so "leave" had no distinct type to submit/approve.
alter table public.time_off_requests
  drop constraint time_off_requests_request_type_check;

alter table public.time_off_requests
  add constraint time_off_requests_request_type_check
  check (request_type in ('time_off', 'break_waiver', 'leave'));

-- UC56 (Approve Fixed Day Off): employee_fixed_off_days had no approval state at all —
-- setting a day off took effect immediately. Add an approval chain matching the rest
-- of the attendance request tables (time_off_requests, shift_swap_requests).
alter table public.employee_fixed_off_days
  add column status text not null default 'pending',
  add column reviewed_by uuid references public.users(id),
  add column reviewed_at timestamptz;

alter table public.employee_fixed_off_days
  add constraint employee_fixed_off_days_status_check
  check (status in ('pending', 'approved', 'rejected'));

-- Existing rows predate the approval flow; treat them as already approved so current
-- schedules/AI scheduling don't regress for days that were already in effect.
update public.employee_fixed_off_days set status = 'approved';
