-- Owner review flow: when the assigner rejects a task in Review it goes back to In Progress
-- with a required reason, shown to the assignee as a rework notice until it is re-submitted.
alter table public.tasks
  add column if not exists rejection_reason text,
  add column if not exists rejected_at timestamptz;
