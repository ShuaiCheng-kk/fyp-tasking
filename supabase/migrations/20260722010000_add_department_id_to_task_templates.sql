-- Task Templates were company-wide with no department scoping (see the original creation
-- migration's comment). That meant any Manager could see, apply, edit, or delete any other
-- Manager's (or Owner/Partner's) template regardless of department. department_id makes a
-- template optionally department-scoped — Manager-created templates are always tagged with
-- their own department; Owner/Partner may tag one to a specific department or leave it null
-- for a company-wide generic template (mirrors job_templates.department_id).
alter table public.task_templates
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists task_templates_department_idx
  on public.task_templates (department_id);
