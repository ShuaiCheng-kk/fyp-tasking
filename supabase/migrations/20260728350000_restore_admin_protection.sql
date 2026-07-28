-- Restore protect_admin_accounts, dropped temporarily by the previous migration to allow a full
-- wipe of the dev database (including platform admin rows, per explicit user request). Same
-- definition as the original 20260704000001_protect_admin_accounts.sql.
CREATE OR REPLACE FUNCTION prevent_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IN ('User Admin', 'Marketing Admin') THEN
    RAISE EXCEPTION 'Cannot delete protected admin accounts (User Admin or Marketing Admin)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_admin_accounts ON users;

CREATE TRIGGER protect_admin_accounts
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION prevent_admin_deletion();
