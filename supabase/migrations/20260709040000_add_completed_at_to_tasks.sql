-- Completed Time: stamped when the assigner approves a task in Review — the only path to
-- Complete. Backfill already-Complete tasks from updated_at so their Details can show a time.
alter table public.tasks
  add column if not exists completed_at timestamptz;

update public.tasks set completed_at = updated_at where status = 'Complete' and completed_at is null;
