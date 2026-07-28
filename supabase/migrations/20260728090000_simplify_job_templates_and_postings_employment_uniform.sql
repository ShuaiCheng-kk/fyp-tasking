-- employment_type: on both tables, always 100% determined by form_type in every real write path
-- (form_type='shift' -> 'part-time', form_type='oneoff' -> 'casual'; the UI never exposes an
-- independent employment-type input) — verified against live data has zero remaining value once
-- form_type is known. Dropped as pure redundancy.
--
-- uniform_required + uniform_type: uniform_type ('company'/'dress_code'/'none') is strictly more
-- granular than uniform_required (a boolean that's always exactly uniform_type != 'none' on every
-- live row — verified, zero inconsistencies). Collapsing to uniform_type alone; rows that
-- predate uniform_type (null) are backfilled to 'none', matching what their uniform_required=false
-- already meant.

update public.job_templates set uniform_type = 'none' where uniform_type is null;
update public.job_postings set uniform_type = 'none' where uniform_type is null;

alter table public.job_templates
  alter column uniform_type set default 'none',
  alter column uniform_type set not null;

alter table public.job_postings
  alter column uniform_type set default 'none',
  alter column uniform_type set not null;

alter table public.job_templates
  drop column if exists employment_type,
  drop column if exists uniform_required;

alter table public.job_postings
  drop column if exists employment_type,
  drop column if exists uniform_required;

comment on column public.job_templates.uniform_type is
  'company = employer provides uniform. dress_code = no uniform, but a specific dress code applies (see uniform_details). none = no requirement.';
comment on column public.job_postings.uniform_type is
  'company = employer provides uniform. dress_code = no uniform, but a specific dress code applies (see uniform_details). none = no requirement.';
