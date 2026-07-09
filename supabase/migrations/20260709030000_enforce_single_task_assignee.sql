-- A task is assigned to exactly one person. Remove co-assignee rows created by the
-- retired multi-assignee flow (keep only each task's primary assignee), then enforce
-- the one-assignee-per-task rule at the database level.
delete from task_assignments ta
using tasks t
where ta.task_id = t.id
  and (t.assigned_user_id is null or ta.user_id <> t.assigned_user_id);

create unique index if not exists task_assignments_task_id_key
  on task_assignments (task_id);
