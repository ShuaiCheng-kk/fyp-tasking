-- Task Delay Alert: per-company threshold (percent of a task's assigned-to-deadline window).
-- A task still sitting in Assigned past this percentage of its window triggers the alert.
create table if not exists public.task_delay_alert_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  threshold_percent integer not null default 50 check (threshold_percent between 1 and 100),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
