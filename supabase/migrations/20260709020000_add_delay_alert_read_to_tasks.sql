-- Task Delay Alert "mark as read": once the assigner has seen a delayed task's alert and
-- acknowledged it, the alert stays dismissed (green) even though the task is still sitting in
-- Assigned. Cleared automatically when the task's deadline changes, so a new delay window can
-- re-raise the alert.
alter table public.tasks
  add column if not exists delay_alert_read_at timestamptz;
