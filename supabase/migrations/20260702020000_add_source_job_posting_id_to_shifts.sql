-- Links a Casual Worker's shift back to the job posting it was hired from, so the Owner can
-- open "what was actually posted" (description, requirements, salary, etc.) from an attendance
-- record instead of only seeing the shift's copied title text. Nullable — most shifts (internal
-- staff, manually created CW shifts) never originated from a job posting.

alter table public.shifts
  add column source_job_posting_id uuid references public.job_postings(id) on delete set null;

create index shifts_source_job_posting_id_idx on public.shifts (source_job_posting_id);
