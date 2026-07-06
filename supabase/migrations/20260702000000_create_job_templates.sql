-- Create job template: reusable title/description/requirements presets for Post Job Opening,
-- company-wide (mirrors shift_templates/task_templates being company-wide, not scoped further).
create table if not exists public.job_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  title text not null,
  description text,
  requirements text,
  employment_type text,
  form_type text,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists job_templates_company_idx
  on public.job_templates (company_id);
