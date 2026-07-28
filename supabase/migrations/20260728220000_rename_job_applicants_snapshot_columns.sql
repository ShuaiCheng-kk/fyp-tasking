-- Shorter, clearer names for the apply-time profile snapshot on job_applicants — "_snapshot" was
-- redundant given the column comments/docs already explain these are frozen at apply time, and
-- resume_url didn't need the _url suffix when every other snapshot field doesn't have one either.
alter table public.job_applicants rename column resume_url to resume;
alter table public.job_applicants rename column skills_snapshot to skills;
alter table public.job_applicants rename column certificates_snapshot to certificates;
