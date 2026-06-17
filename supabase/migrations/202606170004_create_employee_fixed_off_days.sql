-- Create employee_fixed_off_days table
-- weekday: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

create table if not exists public.employee_fixed_off_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  weekday     smallint not null check (weekday >= 0 and weekday <= 6),
  created_at  timestamptz not null default now(),
  unique (user_id, company_id, weekday)
);
