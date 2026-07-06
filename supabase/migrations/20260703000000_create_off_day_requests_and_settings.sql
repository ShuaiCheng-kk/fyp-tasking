-- Replaces the recurring-weekday "Fixed Day Off" model (employee_fixed_off_days) with
-- per-week, specific-date requests, plus Owner-configurable quota and submission deadline.
-- employee_fixed_off_days is intentionally left untouched (old data, no longer read/written
-- by application code) — see project plan for the "leave old table alone" decision.

-- Each row is one specific date a user requested off, submitted as a batch for one week
-- (week_start), or system-generated after the submission deadline passes (source =
-- 'auto_assigned', inserted directly as status = 'approved').
create table public.employee_off_day_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,

  request_date date not null,
  -- Monday of the week request_date falls in — stored redundantly so per-week quota/deadline
  -- queries are a plain indexed equality filter instead of a date-range computation.
  week_start   date not null,

  status       text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),

  -- 'submitted' = the user picked this date themselves. 'auto_assigned' = the deadline passed
  -- and the system picked it for them (auto_assigned rows are inserted as already 'approved').
  source       text not null default 'submitted'
    check (source in ('submitted', 'auto_assigned')),

  reviewed_by  uuid references public.users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),

  unique (user_id, request_date)
);

create index employee_off_day_requests_company_week_idx
  on public.employee_off_day_requests (company_id, week_start);
create index employee_off_day_requests_user_week_idx
  on public.employee_off_day_requests (user_id, week_start);

-- Company-wide default quota (user_id null) plus optional per-Manager override (user_id set).
create table public.off_day_quota_settings (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  user_id            uuid references public.users(id) on delete cascade,
  max_days_per_week  int not null check (max_days_per_week between 1 and 7),
  updated_by         uuid references public.users(id),
  updated_at         timestamptz not null default now()
);

-- At most one company-default row (user_id is null) per company.
create unique index off_day_quota_settings_company_default_idx
  on public.off_day_quota_settings (company_id)
  where user_id is null;

-- At most one override row per (company, user).
create unique index off_day_quota_settings_company_user_idx
  on public.off_day_quota_settings (company_id, user_id)
  where user_id is not null;

-- Single company-wide weekly submission cutoff (no per-Manager variant).
create table public.off_day_submission_deadline (
  company_id       uuid primary key references public.companies(id) on delete cascade,
  -- 0 = Sunday .. 6 = Saturday, matching JS Date#getDay() convention used throughout the app.
  deadline_weekday int not null check (deadline_weekday between 0 and 6),
  updated_by       uuid references public.users(id),
  updated_at       timestamptz not null default now()
);
