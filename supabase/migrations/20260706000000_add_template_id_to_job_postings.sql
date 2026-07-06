-- Track which job template (if any) a job posting was created from, so the Template
-- detail view can show real "used in jobs / published / draft / last used" stats.
alter table public.job_postings
  add column if not exists template_id uuid references public.job_templates(id) on delete set null;

create index if not exists job_postings_template_id_idx
  on public.job_postings (template_id);
