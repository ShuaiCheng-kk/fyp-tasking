-- instruction: two write sites (AI bulk-suggestion accept, manual edit which explicitly nulls it),
-- zero read sites anywhere in the UI.
alter table public.shifts drop column instruction;

-- created_at/updated_at: no ordering or business logic depends on either; no UI displays them.
alter table public.shifts drop column created_at;
alter table public.shifts drop column updated_at;

-- flat_rate: zero write sites anywhere in the app (added for "One-Off Job pay display" per its
-- original migration comment, but never wired up) — always null, so the 3 read sites that check
-- it always fall through to the hourly-rate calculation instead.
alter table public.shifts drop column flat_rate;

-- title: a snapshot copy of job_postings.title for Casual-Worker-sourced shifts (job.title copied
-- in at shift-creation time) — always '' for internal Owner/Manager-created shifts (no UI input
-- for it). Every consumer that needs "this shift's job title" either already fetches the source
-- job_posting for other fields (company_name/location) and can read its title directly, or is
-- internal-only and already showed a generic fallback. Dropped in favor of reading
-- job_postings.title via source_job_posting_id.
alter table public.shifts drop column title;
