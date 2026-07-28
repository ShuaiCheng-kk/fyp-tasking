-- form_type only ever holds 'shift' or 'oneoff' — it IS the job type. Rename to job_type so the
-- column name matches what it actually represents (and the "job_type" name already used ad hoc as
-- an AI-prompt parameter for this exact concept).
alter table public.job_templates rename column form_type to job_type;
alter table public.job_postings rename column form_type to job_type;
