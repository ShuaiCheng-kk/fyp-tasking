-- is_read defaulted to false and was never updated by any code path — the mark-all-read
-- route/service/repository methods existed but had no UI caller. Dropping the column along
-- with that dead code.
alter table public.company_activity_logs
  drop column if exists is_read;
