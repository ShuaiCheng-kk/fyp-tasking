-- Archive must be a distinct state from Complete — a completed task that gets archived was
-- being conflated with status='Complete', which incorrectly surfaced it in the Complete Kanban
-- column. is_archived hides a task from the board entirely regardless of its status.
alter table public.tasks
  add column if not exists is_archived boolean not null default false;

create index if not exists tasks_is_archived_idx on public.tasks (company_id, is_archived);
