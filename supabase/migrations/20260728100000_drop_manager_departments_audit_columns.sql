-- assigned_by/assigned_at were never read anywhere (every select() on manager_departments only
-- ever pulls department_id, sometimes manager_id) and even as a write-only audit trail they were
-- incomplete: only the explicit "assign manager to department" path (assignManagerDepartment)
-- populated assigned_by, while invite-code redemption (insertManagerDepartment) and the Team page's
-- "change member department" reassignment (moveManagerToDepartment) always left it NULL.

alter table public.manager_departments
  drop column if exists assigned_by,
  drop column if exists assigned_at;
