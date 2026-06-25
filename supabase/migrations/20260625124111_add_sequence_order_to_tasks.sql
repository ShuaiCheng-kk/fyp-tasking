-- UC22 Create Sub Task / UC28 Set Task Dependencies
-- Sub-tasks under the same parent_task_id are ordered by sequence_order (0-based).
-- Null for the main task and for any task with fewer than 2 siblings.
alter table public.tasks
  add column if not exists sequence_order integer;
