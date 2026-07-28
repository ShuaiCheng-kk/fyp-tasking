-- job_templates.description / job_postings.description are shown everywhere in the UI (owner
-- form, template form, guest-facing job page) under the label "Responsibilities", never
-- "Description". Same for .requirements, always labeled "Skills & Qualifications". Rename the
-- columns to match what they actually hold so code and UI agree.
alter table public.job_templates rename column description to responsibilities;
alter table public.job_templates rename column requirements to skills;

alter table public.job_postings rename column description to responsibilities;
alter table public.job_postings rename column requirements to skills;
