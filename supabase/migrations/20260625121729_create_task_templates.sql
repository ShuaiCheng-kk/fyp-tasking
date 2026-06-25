-- Create task template: reusable title/description/priority presets for New Task, company-wide
-- (mirrors shift_templates being company-wide, not department-scoped).
create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  title text not null,
  description text,
  priority text,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists task_templates_company_idx
  on public.task_templates (company_id);
