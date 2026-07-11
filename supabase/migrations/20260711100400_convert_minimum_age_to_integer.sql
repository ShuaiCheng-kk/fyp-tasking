-- Minimum age is a hard eligibility gate compared against the applicant's date of birth by
-- deterministic code (never AI), so it must be numeric — free-text values like "21+" can't be
-- compared. Strips non-digits from any existing values during conversion.
alter table public.job_postings
  alter column minimum_age type integer
  using nullif(regexp_replace(coalesce(minimum_age::text, ''), '\D', '', 'g'), '')::integer;

alter table public.job_templates
  alter column minimum_age type integer
  using nullif(regexp_replace(coalesce(minimum_age::text, ''), '\D', '', 'g'), '')::integer;
