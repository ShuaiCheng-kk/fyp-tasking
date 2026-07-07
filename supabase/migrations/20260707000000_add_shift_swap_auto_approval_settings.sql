-- Shift Swap auto-approval: Owner-configured rules that let conforming swap requests
-- (same department, same role, both parties accepted, within limit/deadline) finalize
-- automatically instead of always waiting in the Owner's Action Needed queue.

alter table shift_swap_requests
  add column if not exists requires_owner_review boolean not null default false;

create table if not exists shift_swap_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  auto_approval_enabled boolean not null default false,
  monthly_swap_limit integer,
  deadline_weekday integer,
  deadline_time text,
  require_review_on_limit_exceeded boolean not null default true,
  require_review_on_deadline_exceeded boolean not null default true,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now(),
  constraint shift_swap_settings_limit_positive check (monthly_swap_limit is null or monthly_swap_limit > 0),
  constraint shift_swap_settings_weekday_range check (deadline_weekday is null or (deadline_weekday >= 0 and deadline_weekday <= 6)),
  constraint shift_swap_settings_time_format check (deadline_time is null or deadline_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  constraint shift_swap_settings_deadline_pair check ((deadline_weekday is null) = (deadline_time is null))
);
