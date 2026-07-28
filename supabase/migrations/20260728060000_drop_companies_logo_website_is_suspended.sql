-- logo_url/website: dead weight -- no upload/edit UI ever existed for either anywhere in the app
-- (confirmed across CompanySettingsView, get-started, and every company setup route before writing
-- this migration); every write site sent them as a hardcoded null. is_suspended: redundant boolean
-- that always moved in lockstep with suspended_at (see suspendCompany/unsuspendCompany in
-- userAdminRepository.ts) -- suspended_at IS NOT NULL already says the same thing, so callers now
-- derive the flag from that instead.
--
-- Not reordering the remaining columns here: companies has 25 inbound FK constraints from other
-- tables (shifts, tasks, users, departments, ...), and Postgres has no ALTER TABLE ... POSITION --
-- true column reordering means rename-old/create-new/copy-over, which would orphan every one of
-- those 25 FKs (they bind to the specific relation, not the table name) and require recreating all
-- of them across 25 other tables. Not worth that blast radius for a purely cosmetic change with
-- zero functional benefit -- unlike casualworker_departments (zero inbound FKs), a rebuild here
-- is not safe to do casually.

alter table public.companies
  drop column if exists logo_url,
  drop column if exists website,
  drop column if exists is_suspended;
