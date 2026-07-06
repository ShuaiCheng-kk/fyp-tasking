-- Task templates can predefine a set of sub-task titles, so using a template also seeds the
-- New Task modal's Sub Task list instead of just title/description/priority.
alter table public.task_templates
  add column if not exists sub_task_titles text[] not null default '{}';
