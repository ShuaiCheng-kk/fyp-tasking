-- Multi-assignee Tasks: a task can be assigned to more than one person, mirroring how
-- shift_assignments already lets a shift have more than one assignee. tasks.assigned_user_id
-- stays as the always-in-sync "primary" assignee (kept for AI workload/stalled-alert/activity-feed
-- logic that only reasons about one person per task); task_assignments is the source of truth for
-- the full assignee set used by Kanban visibility and drag permission.

create table if not exists public.task_assignments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  assigned_by  uuid references public.users(id),
  created_at   timestamptz not null default now(),
  unique (task_id, user_id)
);

create index if not exists task_assignments_task_id_idx on public.task_assignments (task_id);
create index if not exists task_assignments_user_id_idx on public.task_assignments (user_id);

-- Backfill: every existing task's current single assignee becomes its first task_assignments row.
insert into public.task_assignments (task_id, user_id, assigned_by)
select id, assigned_user_id, assigned_by from public.tasks
where assigned_user_id is not null
on conflict (task_id, user_id) do nothing;
