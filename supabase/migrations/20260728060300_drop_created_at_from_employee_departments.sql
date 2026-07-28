-- Pure membership join table (employee <-> department) — every query against it names exact
-- columns (employee_id/department_id, or a users join) and none ever select created_at.
alter table public.employee_departments
  drop column if exists created_at;
