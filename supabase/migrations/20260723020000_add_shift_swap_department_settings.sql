-- Shift Swap settings, split by scope (confirmed 2026-07-23):
-- shift_swap_settings (existing, company-wide, Owner/Partner-owned) now governs Manager<->Manager
-- swaps only. Employee<->Employee swaps are decided by the Employees' Manager, so they need their
-- own settings, scoped per department and owned by that department's Manager(s).

create table if not exists shift_swap_department_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  auto_approval_enabled boolean not null default false,
  monthly_swap_limit integer,
  deadline_hours_before_shift integer,
  require_review_on_limit_exceeded boolean not null default true,
  require_review_on_deadline_exceeded boolean not null default true,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now(),
  unique (company_id, department_id),
  constraint shift_swap_dept_settings_limit_positive check (monthly_swap_limit is null or monthly_swap_limit > 0),
  constraint shift_swap_dept_settings_deadline_hours_positive check (deadline_hours_before_shift is null or deadline_hours_before_shift > 0)
);
