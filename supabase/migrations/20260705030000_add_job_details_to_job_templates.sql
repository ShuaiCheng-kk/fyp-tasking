-- Job Templates (UC36) now capture the same details the Post Job Opening wizard collects,
-- so applying a template pre-fills department and pay defaults too. Application Deadline is
-- deliberately NOT part of the template — it's set fresh each time a posting is created.
alter table public.job_templates
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists salary_amount numeric,
  add column if not exists salary_type text;
