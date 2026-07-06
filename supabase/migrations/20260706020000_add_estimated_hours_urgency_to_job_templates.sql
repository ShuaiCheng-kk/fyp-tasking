-- One-off job templates need the same Est. Hours / Urgency fields the Post Job Opening
-- wizard collects for one-off jobs, so applying a one-off template pre-fills them too.
alter table public.job_templates
  add column if not exists estimated_hours text,
  add column if not exists urgency text;
