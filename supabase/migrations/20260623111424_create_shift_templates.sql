-- Create shift template: reusable department + time-of-day presets for Assign Shift.
create table if not exists public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists shift_templates_company_idx
  on public.shift_templates (company_id, department_id);
