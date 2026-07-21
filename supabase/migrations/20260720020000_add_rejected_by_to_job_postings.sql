-- Manager Recruitment: rejected postings need to record WHO rejected them (Owner/Partner), not
-- just the reason, so a Manager's job list can show "Rejected By: <name>" alongside the reason.
alter table public.job_postings
  add column if not exists rejected_by uuid references public.users(id) on delete set null;
