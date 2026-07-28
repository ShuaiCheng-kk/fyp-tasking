-- updated_by/updated_at were never read anywhere: AttendanceView.tsx and MyRequestsPanel.tsx (the
-- only two places that consume this setting) destructure just deadline_weekday/deadline_time, and
-- ownerDashboardService.ts's formatDeadlineLabel does the same. No UI ever showed "last changed by
-- X on Y" for this setting.

alter table public.off_day_submission_deadline
  drop column if exists updated_by,
  drop column if exists updated_at;
