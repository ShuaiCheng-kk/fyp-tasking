alter table public.recruitment_cancellations
  rename to job_cancellations;

alter index if exists idx_recruitment_cancellations_job_id
  rename to idx_job_cancellations_job_id;

alter index if exists idx_recruitment_cancellations_applicant_id
  rename to idx_job_cancellations_applicant_id;
