-- UC19/UC20 Recurring Task: link recurring task copies the same way recurring shifts do
-- (recurrence_group_id shared by the whole series, source_task_id null only on the original).
-- Deleting the original cascades to siblings at the service layer, not via FK action.
alter table public.tasks
  add column if not exists recurrence_group_id uuid null;

alter table public.tasks
  add column if not exists source_task_id uuid null references public.tasks(id) on delete set null;

create index if not exists tasks_recurrence_group_id_idx on public.tasks (recurrence_group_id);
