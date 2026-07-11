-- Application = per-job answers + a snapshot of the worker's profile taken at apply time.
-- Later profile edits must never change what the employer saw, so skills/certificates/resume
-- are copied onto the application row instead of being read live.
alter table public.job_applicants add column if not exists relevant_experience text;
alter table public.job_applicants add column if not exists additional_note text;
alter table public.job_applicants add column if not exists skills_snapshot text;
alter table public.job_applicants add column if not exists certificates_snapshot jsonb;
alter table public.job_applicants add column if not exists age_at_apply integer;

-- AI match analysis is computed once per application and cached; recomputed only when the
-- underlying data changes, never on every page open.
alter table public.job_applicants add column if not exists ai_score integer;
alter table public.job_applicants add column if not exists ai_summary text;
alter table public.job_applicants add column if not exists ai_computed_at timestamptz;

-- Status set grows: cancelled_by_employer (was accepted, employer removed the worker — NOT
-- the same as rejected) and job_closed (posting closed/expired while application was pending).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.job_applicants'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.job_applicants drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.job_applicants add constraint job_applicants_status_check
  check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'cancelled_by_employer', 'job_closed'));

alter table public.job_applicants
  add constraint job_applicants_relevant_experience_check
  check (relevant_experience is null or relevant_experience in ('none', 'less_than_1', '1_to_2', 'more_than_2'));
