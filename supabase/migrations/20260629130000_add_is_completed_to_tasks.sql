-- Sub-task "to-do" checkbox state — independent of status, since status already carries the
-- drag-and-drop column (Assigned/In Progress/Review/Complete) and is cascaded from the parent
-- task. is_completed only tracks whether a sub-task's own checkbox has been ticked once its
-- parent is In Progress, and is unrelated to which Kanban column the sub-task sits in.
alter table public.tasks
  add column if not exists is_completed boolean not null default false;
