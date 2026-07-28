-- updated_by/updated_at never read anywhere: AttendanceView.tsx's fetched-settings type only
-- declares user_id/max_days_per_week/role (updated_by/updated_at aren't even in the type), and the
-- per-user "my_quota" lookup returns just a bare number. Same dead-weight pattern as
-- off_day_submission_deadline (see 20260728120000).

alter table public.off_day_quota_settings
  drop column if exists updated_by,
  drop column if exists updated_at;
