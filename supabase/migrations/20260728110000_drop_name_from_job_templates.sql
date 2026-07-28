-- job_templates.name was always written equal to title (RecruitmentView.tsx never exposed a
-- separate "template name" input) and never read/displayed anywhere in the UI — dead, write-only
-- duplicate of title. Drop it; title is the single source of truth.
alter table public.job_templates drop column name;
