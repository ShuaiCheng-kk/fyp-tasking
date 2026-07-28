-- job_templates.salary_type: 100% determined by job_type at every write site (shift -> 'per
-- hour', oneoff -> 'flat rate'), never displayed anywhere — same pattern already dropped from
-- job_postings, which never had this column at all.
alter table public.job_templates drop column salary_type;

-- job_postings.expiry_preset: default 'none', never read or written by any code path.
alter table public.job_postings drop column expiry_preset;

-- job_postings.shift_days: the create form never exposed a way to set it (only ever populated by
-- seed data bypassing the app) — the multi-weekday recurring logic that read it was dead in
-- practice; jobPostingWindows now always uses the single weekday from shift_date instead.
alter table public.job_postings drop column shift_days;

-- job_postings.job_date: never written by any code path; its one read site (a `shift_date ??
-- job_date` fallback in ApplyJobModal) never fired since shift_date is always populated instead.
alter table public.job_postings drop column job_date;

-- job_postings.location: the create form never exposed an input for it — always null in real
-- usage. The one real consumer (the offer-confirmed email) now reads the company's own location
-- (joined from companies) instead.
alter table public.job_postings drop column location;
