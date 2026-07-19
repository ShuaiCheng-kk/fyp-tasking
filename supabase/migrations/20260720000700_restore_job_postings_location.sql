-- Incident fix: job_postings.location was dropped in 20260719230000 based on an audit that
-- missed real usage — it IS rendered (Casual Worker dashboard map pin, embedded Google Maps,
-- directions link, and the attendance record view). The previous DROP COLUMN was destructive;
-- existing location values for prior postings cannot be recovered (no backup available) and this
-- re-add starts the column empty. New/edited postings will populate it going forward.

alter table job_postings
  add column if not exists location text;
