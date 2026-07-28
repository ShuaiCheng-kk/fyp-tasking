-- payment_method/payment_account/skills/resume_url moved to casual_worker_profiles (previous
-- migration). worker_status/inactivate_reason were only ever a mirror of the authoritative
-- per-company casualworker_departments.inactive_at/inactive_reason ban, kept for a couple of
-- display surfaces that now read the per-company table directly instead. home_location is
-- write-only (collected at Guest signup, never read back anywhere) and the product no longer
-- wants it. hourly_rate was a fixed per-worker wage even though pay should be decided by the job,
-- not the person — replaced by shifts.hourly_rate (sourced from job_postings.salary_amount at
-- shift-creation time). weekly_working_hours/max_weekly_hours/contracted_weekly_hours were never
-- written anywhere — the one scheduling rule that should have used max_weekly_hours reads a
-- hardcoded constant instead, and the only UI that displayed them is a disconnected dummy stub.
alter table public.users
  drop column payment_method,
  drop column payment_account,
  drop column skills,
  drop column resume_url,
  drop column home_location,
  drop column worker_status,
  drop column inactivate_reason,
  drop column hourly_rate,
  drop column weekly_working_hours,
  drop column max_weekly_hours,
  drop column contracted_weekly_hours;
