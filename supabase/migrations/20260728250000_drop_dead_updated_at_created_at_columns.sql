-- Both columns were pure audit fields never read by any query or UI:
-- task_delay_alert_settings.updated_at — updated_by already attributes who changed the threshold.
-- task_assignments.created_at — only consumer was an ORDER BY that stopped mattering once
-- 20260709030000 enforced one assignment row per task (multi-assignee ordering no longer applies).
alter table public.task_delay_alert_settings
  drop column if exists updated_at;

alter table public.task_assignments
  drop column if exists created_at;
