-- Splits the single company-wide default off-day quota into one default per role
-- (Manager, Employee), so Owner can set "Manager Off Days" and "Employee Off Days"
-- separately instead of one shared number. Per-user override rows are untouched.

alter table public.off_day_quota_settings
  add column role text check (role in ('Manager', 'Employee'));

-- Drop the old "one default per company" index before backfilling, since the clone insert
-- below would otherwise violate it (two user_id-null rows for the same company).
drop index if exists off_day_quota_settings_company_default_idx;

-- Backfill: the existing single default row (user_id null) becomes the Manager default,
-- and is cloned as the Employee default too, so behavior is unchanged until Owner adjusts either one.
update public.off_day_quota_settings
  set role = 'Manager'
  where user_id is null;

insert into public.off_day_quota_settings (company_id, user_id, max_days_per_week, updated_by, role)
select company_id, null, max_days_per_week, updated_by, 'Employee'
from public.off_day_quota_settings
where user_id is null and role = 'Manager';

alter table public.off_day_quota_settings
  add constraint off_day_quota_settings_role_matches_user_id
  check ((user_id is null and role is not null) or (user_id is not null and role is null));

-- At most one default row per (company, role) — replaces the old "one default per company" index.
create unique index off_day_quota_settings_company_default_idx
  on public.off_day_quota_settings (company_id, role)
  where user_id is null;
