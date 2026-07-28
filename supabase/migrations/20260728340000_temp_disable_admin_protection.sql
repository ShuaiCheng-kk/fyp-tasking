-- Temporary: user requested a full database wipe (all rows, all roles, no exceptions) to reset
-- the dev environment to empty. Drop the protect_admin_accounts trigger so the cleanup script can
-- delete the two real platform admin rows plus leftover Playwright test-garbage rows that also
-- carry a protected role. Restored immediately after by the next migration.
drop trigger if exists protect_admin_accounts on users;
drop function if exists prevent_admin_deletion();
