-- Shift Swap validation rework (Owner-confirmed business rules):
-- 1. Monthly limit counts only SUCCESSFUL (approved) swaps — rejected/withdrawn/expired don't
--    use up quota. (Enforced in code; no schema change needed for this.)
-- 2. Deadline becomes "N hours before the earliest of the two shifts" instead of a weekly
--    weekday+time cutoff.
-- 3. Rules are validated when the counterpart ACCEPTS (not at submission), and a request
--    escalated to the Owner records WHY in owner_review_reason.

alter table shift_swap_settings
  drop constraint if exists shift_swap_settings_weekday_range;
alter table shift_swap_settings
  drop constraint if exists shift_swap_settings_time_format;
alter table shift_swap_settings
  drop constraint if exists shift_swap_settings_deadline_pair;

alter table shift_swap_settings
  drop column if exists deadline_weekday;
alter table shift_swap_settings
  drop column if exists deadline_time;
alter table shift_swap_settings
  add column if not exists deadline_hours_before_shift integer;

alter table shift_swap_settings
  add constraint shift_swap_settings_deadline_hours_positive
    check (deadline_hours_before_shift is null or deadline_hours_before_shift > 0);

-- Why a rule breach sent this request to the Owner (or auto-rejected it) — e.g.
-- 'Monthly swap limit exceeded' / 'Submitted after deadline'. Null for clean requests.
alter table shift_swap_requests
  add column if not exists owner_review_reason text;
