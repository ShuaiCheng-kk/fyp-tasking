-- 3-way uniform mode replacing the Yes/No "Attire Required" UX:
--   'none' | 'company' (Company Uniform Provided) | 'dress_code' (Specific Dress Code).
-- uniform_required stays as the legacy boolean (true when type is company/dress_code)
-- so existing readers keep working; uniform_details holds the free text for either mode.
alter table public.job_templates
  add column if not exists uniform_type text;

alter table public.job_postings
  add column if not exists uniform_type text;

-- Backfill legacy rows: required=true was always company-provided attire in practice.
update public.job_templates set uniform_type = case when uniform_required then 'company' else 'none' end where uniform_type is null;
update public.job_postings  set uniform_type = case when uniform_required then 'company' else 'none' end where uniform_type is null;
