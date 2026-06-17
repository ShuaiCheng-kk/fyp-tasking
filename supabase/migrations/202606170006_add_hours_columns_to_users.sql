alter table public.users
  add column if not exists weekly_working_hours numeric,
  add column if not exists max_weekly_hours numeric,
  add column if not exists contracted_weekly_hours numeric;
