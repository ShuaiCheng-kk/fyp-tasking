alter table public.tasks
  add column if not exists task_date date;

update public.tasks
set task_date = coalesce(task_date, created_at::date)
where task_date is null;
