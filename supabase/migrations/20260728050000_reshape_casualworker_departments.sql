-- Rebuild casualworker_departments (rather than a plain ALTER) because this change needs three
-- things a rename/drop alone can't do together: reorder columns (company_id before department_id
-- reads more naturally and Postgres has no ALTER TABLE ... POSITION), drop the never-queried
-- created_at (pure bookkeeping nobody reads), and rename blocked_at/blocked_reason to
-- inactive_at/inactive_reason to match the product's own language — the Team page action is
-- "mark inactive", "blocked" was never a term used anywhere in the UI. No other table has an FK
-- to this one and no view reads it (confirmed before writing this migration), so a rebuild is safe.

alter table public.casualworker_departments rename to casualworker_departments_old;

create table public.casualworker_departments (
  id                uuid primary key default gen_random_uuid(),
  casual_worker_id  uuid not null references public.users(id) on delete cascade,
  company_id        uuid references public.companies(id) on delete cascade,
  department_id     uuid not null references public.departments(id) on delete cascade,
  verified_at       timestamptz null,
  inactive_at       timestamptz null,
  inactive_reason   text null
);

insert into public.casualworker_departments
  (id, casual_worker_id, company_id, department_id, verified_at, inactive_at, inactive_reason)
select id, casual_worker_id, company_id, department_id, verified_at, blocked_at, blocked_reason
from public.casualworker_departments_old;

drop table public.casualworker_departments_old;

create unique index casualworker_departments_unique_membership
  on public.casualworker_departments (casual_worker_id, department_id);
create index casualworker_departments_casual_worker_id_idx on public.casualworker_departments (casual_worker_id);
create index casualworker_departments_department_id_idx on public.casualworker_departments (department_id);
create index casualworker_departments_company_id_idx on public.casualworker_departments (company_id);

comment on column public.casualworker_departments.verified_at is
  'First completed clock-out for this worker in this department. NULL = confirmed but never worked a shift yet. Non-null promotes them into the verified Casual Worker pool; the value itself (not just non-null) is used to pick a worker''s earliest-verified department when they are verified in more than one.';
comment on column public.casualworker_departments.inactive_at is
  'Per-company ban ("mark inactive" on the Team page). NULL = active for this company. Non-null = banned at that time. Scoped to this company only — the same worker can still be active for a different company.';
comment on column public.casualworker_departments.inactive_reason is
  'Reason given when this worker was marked inactive for this company.';
