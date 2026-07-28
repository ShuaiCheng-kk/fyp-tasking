-- job_applicants.cover_letter: no input control anywhere ever wrote it (ApplyJobModal has no
-- cover letter field, createApplication never sets it) and no page ever rendered it — pure
-- dead column since it was added.
alter table public.job_applicants drop column if exists cover_letter;

-- job_applicants.relevant_experience: the per-application experience picker was replaced by a
-- hard experience-gate confirmation checkbox (ApplyJobModal's "I have the required experience"),
-- so every insert path has written null here ever since — dead going forward, and the AI
-- candidate recommendation prompt no longer reads it either.
alter table public.job_applicants drop column if exists relevant_experience;

alter table public.job_applicants drop constraint if exists job_applicants_relevant_experience_check;
