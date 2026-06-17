-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: availability data for AI scheduling
--
-- HOW TO USE:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Run the CLEAR section first, then the INSERT section.
--   3. Replace placeholder UUIDs with real user/company IDs from your database.
--
-- To find your real IDs, run:
--   SELECT id, full_name, role, company_id FROM users WHERE role IN ('Manager','Employee');
--   SELECT id, name FROM companies;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: Clear existing availability data ──────────────────────────────────
TRUNCATE TABLE employee_fixed_off_days RESTART IDENTITY CASCADE;
DELETE FROM time_off_requests;

-- Reset per-user hour columns (set to NULL to start fresh)
UPDATE users SET weekly_working_hours = NULL, max_weekly_hours = NULL, contracted_weekly_hours = NULL
WHERE role IN ('Manager', 'Employee');

-- ── STEP 2: Seed weekly working hours per user ────────────────────────────────
-- Replace <manager_1_id>, <employee_1_id>, etc. with real user UUIDs.
-- weekly_working_hours = hours already scheduled this week (current usage)
-- max_weekly_hours     = hard cap per week (used by AI scheduler)
-- contracted_weekly_hours = contracted hours per week

/*
UPDATE users SET
  weekly_working_hours = 20,
  max_weekly_hours = 44,
  contracted_weekly_hours = 40
WHERE id = '<manager_1_id>';

UPDATE users SET
  weekly_working_hours = 16,
  max_weekly_hours = 40,
  contracted_weekly_hours = 38
WHERE id = '<employee_1_id>';

UPDATE users SET
  weekly_working_hours = 8,
  max_weekly_hours = 44,
  contracted_weekly_hours = 40
WHERE id = '<employee_2_id>';
*/

-- ── STEP 3: Seed fixed off days ───────────────────────────────────────────────
-- weekday: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

/*
INSERT INTO employee_fixed_off_days (user_id, company_id, weekday) VALUES
  ('<employee_1_id>', '<company_id>', 0),  -- Sunday off
  ('<employee_1_id>', '<company_id>', 6),  -- Saturday off
  ('<employee_2_id>', '<company_id>', 5),  -- Friday off
  ('<manager_1_id>',  '<company_id>', 0);  -- Sunday off
*/

-- ── STEP 4: Seed leave requests ───────────────────────────────────────────────
-- status: 'pending' | 'approved' | 'rejected'
-- request_type: 'annual' | 'sick' | 'personal' | 'time_off'

/*
INSERT INTO time_off_requests (company_id, requester_id, request_type, reason, status) VALUES
  ('<company_id>', '<employee_1_id>', 'annual',   'Family holiday',      'approved'),
  ('<company_id>', '<employee_2_id>', 'sick',      'Medical appointment', 'pending'),
  ('<company_id>', '<manager_1_id>',  'personal',  'Personal matter',     'approved');
*/
