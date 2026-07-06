-- Job postings can now carry the same Uniform Required, Experience Required, and Minimum Age
-- presets as job templates (UC36) — previously these were dropped when a template was applied.
alter table public.job_postings
  add column if not exists uniform_required boolean not null default false,
  add column if not exists uniform_details text,
  add column if not exists experience_required text,
  add column if not exists minimum_age text;
