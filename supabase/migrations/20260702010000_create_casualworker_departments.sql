-- Casual Worker <-> Department membership — mirrors employee_departments/manager_departments so
-- a Casual Worker has an explicit, stable "home department" instead of one derived ad hoc from
-- shift history. Needed so getTeamByCompany/getTeamByDepartment can resolve a CW's department_id
-- (previously always null for CWs, which silently hid every Casual Worker from department-scoped
-- member pickers — e.g. an Employee could never see any CW to assign a task to).

create table public.casualworker_departments (
  id                uuid primary key default gen_random_uuid(),
  casual_worker_id  uuid not null references public.users(id) on delete cascade,
  department_id     uuid not null references public.departments(id) on delete cascade,
  company_id        uuid references public.companies(id) on delete cascade,
  created_at        timestamptz not null default now()
);

create unique index casualworker_departments_unique_membership
  on public.casualworker_departments (casual_worker_id, department_id);

create index casualworker_departments_casual_worker_id_idx on public.casualworker_departments (casual_worker_id);
create index casualworker_departments_department_id_idx on public.casualworker_departments (department_id);
create index casualworker_departments_company_id_idx on public.casualworker_departments (company_id);

-- Backfill from existing shift assignment history so currently-hired Casual Workers aren't
-- orphaned from every department picker until their next shift is created.
insert into public.casualworker_departments (casual_worker_id, department_id, company_id)
select distinct
  sa.user_id,
  s.department_id,
  s.company_id
from public.shift_assignments sa
join public.shifts s on s.id = sa.shift_id
join public.users u on u.id = sa.user_id
where u.role = 'Casual Worker'
  and s.department_id is not null
on conflict (casual_worker_id, department_id) do nothing;
