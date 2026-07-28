-- is_recurring: 100% mirrors job_type = 'shift' at the only write path (createJobPosting) —
-- verified zero mismatches across every live row. Pure redundancy, same pattern as the
-- already-dropped employment_type/uniform_required.
alter table public.job_postings drop column is_recurring;

-- company_name: a per-posting snapshot of the poster's company name. On every owner/manager page
-- it was already fully redundant with the session's own company context (every read site already
-- fell back to it: `p.company_name ?? companyName`). The one real consumer was the public job
-- board (/api/jobs/public), whose companies() join deliberately excluded name and relied on this
-- column instead — that join now includes name directly, so the stored copy is no longer needed.
alter table public.job_postings drop column company_name;
