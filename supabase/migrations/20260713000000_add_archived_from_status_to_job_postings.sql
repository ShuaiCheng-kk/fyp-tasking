-- Archiving a posting overwrites status with 'archived', which previously lost whether the
-- posting was 'open' or 'closed' beforehand — Unarchive always restored it to 'open', silently
-- re-listing a Closed job as Active. This column snapshots the pre-archive status so Unarchive
-- can restore it correctly.
alter table public.job_postings
  add column if not exists archived_from_status text;
