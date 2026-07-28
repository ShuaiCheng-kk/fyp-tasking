-- employee_off_day_requests holds both Employee AND Manager submissions (Fixed Day Off is
-- decided by Owner/Partner regardless of requester role) — the "employee_" prefix was
-- misleading. request_date/week_start renamed for clarity (requested_date/requested_week).

alter table public.employee_off_day_requests
  rename to off_day_requests;

alter table public.off_day_requests
  rename column request_date to requested_date;

alter table public.off_day_requests
  rename column week_start to requested_week;
