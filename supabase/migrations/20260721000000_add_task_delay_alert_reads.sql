-- Task Delay Alert "mark as read" was a single tasks.delay_alert_read_at column, shared by
-- whoever clicked it — since Owner and Partner are peer assigner roles viewing the same tasks,
-- one of them dismissing an alert silently dismissed it for the other too, even though they
-- never saw it. Replace with a per-user acknowledgement table so each viewer's dismissal is
-- independent. Cleared per-task (all viewers) when the task's deadline changes, so a new delay
-- window re-raises the alert for everyone again.
create table if not exists public.task_delay_alert_reads (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists idx_task_delay_alert_reads_user_id on public.task_delay_alert_reads(user_id);

alter table public.tasks
  drop column if exists delay_alert_read_at;
