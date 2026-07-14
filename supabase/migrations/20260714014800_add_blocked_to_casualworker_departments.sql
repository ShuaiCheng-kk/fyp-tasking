-- Per-company ban for a Casual Worker. An Owner marking a CW "inactive" from the Team page means
-- "ban this worker from applying to OUR company's jobs" — it must NOT leak to other companies the
-- same worker has worked for. worker_status on users is a single global column and can't express
-- that, so the ban lives here on casualworker_departments (which already carries company_id and
-- verified_at). blocked_at NULL = not banned by this company; non-null = banned at that time.
alter table public.casualworker_departments
  add column blocked_at timestamptz null,
  add column blocked_reason text null;
