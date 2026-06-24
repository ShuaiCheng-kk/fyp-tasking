-- Shift templates are reusable across all departments in a company, not scoped to one department.
drop index if exists public.shift_templates_company_idx;

alter table public.shift_templates
  drop column if exists department_id;

create index if not exists shift_templates_company_idx
  on public.shift_templates (company_id);
