-- Prevent deletion of User Admin and Marketing Admin accounts at the database level.
-- To remove this protection, run:
--   DROP TRIGGER protect_admin_accounts ON users;
--   DROP FUNCTION prevent_admin_deletion();

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
