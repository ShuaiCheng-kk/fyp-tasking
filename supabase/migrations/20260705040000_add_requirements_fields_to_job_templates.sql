-- Job Templates (UC36) now also capture Uniform Required, Experience Required, and Minimum Age
-- presets, so applying a template pre-fills these requirement fields too.
alter table public.job_templates
  add column if not exists uniform_required boolean not null default false,
  add column if not exists experience_required text,
  add column if not exists minimum_age text;
