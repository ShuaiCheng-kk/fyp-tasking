-- Seed real availability data
-- Company: 5049135a-656a-4848-bf66-6faba6a2e877

-- ── STEP 1: Clear existing data ───────────────────────────────────────────────
TRUNCATE TABLE employee_fixed_off_days RESTART IDENTITY CASCADE;
DELETE FROM time_off_requests;
UPDATE users SET weekly_working_hours = NULL, max_weekly_hours = NULL, contracted_weekly_hours = NULL
WHERE role IN ('Manager', 'Employee');

-- ── STEP 2: Weekly working hours ──────────────────────────────────────────────
-- Managers (max 44h, contracted 40h, varying current usage)
UPDATE users SET weekly_working_hours = 18, max_weekly_hours = 44, contracted_weekly_hours = 40 WHERE id = '95a8ea6e-6646-4da9-8277-0edbd8a32baf'; -- Aaron Wong
UPDATE users SET weekly_working_hours = 24, max_weekly_hours = 44, contracted_weekly_hours = 40 WHERE id = 'c099f56c-439e-4f9a-8312-f108cdbca5c5'; -- David Lim
UPDATE users SET weekly_working_hours = 12, max_weekly_hours = 44, contracted_weekly_hours = 40 WHERE id = '53e44ad9-9fd5-4543-b87c-68829e357aa8'; -- Ethan Goh
UPDATE users SET weekly_working_hours = 20, max_weekly_hours = 44, contracted_weekly_hours = 40 WHERE id = '3bc2cea1-0b19-44db-a920-0026a3247f80'; -- Fiona Chen
UPDATE users SET weekly_working_hours = 16, max_weekly_hours = 44, contracted_weekly_hours = 40 WHERE id = 'a21e7af6-9062-42bc-bcbd-570eba487d80'; -- Jasmine Lee
UPDATE users SET weekly_working_hours = 28, max_weekly_hours = 44, contracted_weekly_hours = 40 WHERE id = '0e008b63-4bd2-4c88-bd1e-9d8a58a9681a'; -- Marcus Ong
UPDATE users SET weekly_working_hours = 10, max_weekly_hours = 44, contracted_weekly_hours = 40 WHERE id = 'abbee208-4450-4221-8fd9-8aaa331828ee'; -- Rachel Koh
UPDATE users SET weekly_working_hours = 22, max_weekly_hours = 44, contracted_weekly_hours = 40 WHERE id = 'a849d78d-0009-464f-99b9-8841a911010a'; -- Vivian Ho

-- Employees (max 40h, contracted 38h, varying current usage)
UPDATE users SET weekly_working_hours = 16, max_weekly_hours = 40, contracted_weekly_hours = 38 WHERE id = 'f7e37388-97e5-4a2f-a8a8-c668416638d5'; -- Ben Seah
UPDATE users SET weekly_working_hours = 24, max_weekly_hours = 40, contracted_weekly_hours = 38 WHERE id = '445a296e-51ed-46ba-b0d2-70e13cbe22a3'; -- Chloe Yeo
UPDATE users SET weekly_working_hours = 8,  max_weekly_hours = 40, contracted_weekly_hours = 38 WHERE id = '6def3b79-8377-4132-977d-a09c29cfbd7d'; -- Daniel Tay
UPDATE users SET weekly_working_hours = 32, max_weekly_hours = 40, contracted_weekly_hours = 38 WHERE id = 'bd334271-0e01-4d7a-a95a-422dc8b8ad88'; -- Elaine Chua
UPDATE users SET weekly_working_hours = 20, max_weekly_hours = 40, contracted_weekly_hours = 38 WHERE id = '7d2a50d1-7bbf-4ec6-ae38-1903a4e65521'; -- Felix Ng
UPDATE users SET weekly_working_hours = 12, max_weekly_hours = 40, contracted_weekly_hours = 38 WHERE id = 'c36227ce-df9d-4a28-83e6-cd4379d9dea7'; -- Grace Lau
UPDATE users SET weekly_working_hours = 28, max_weekly_hours = 40, contracted_weekly_hours = 38 WHERE id = '8ee59110-994b-4250-a992-556f0bb3c4c8'; -- Henry Sim
UPDATE users SET weekly_working_hours = 0,  max_weekly_hours = 40, contracted_weekly_hours = 38 WHERE id = '4e0fc4b2-5ff4-40bf-931f-1b5bb11b0c16'; -- Irene Tan

-- ── STEP 3: Fixed off days ────────────────────────────────────────────────────
-- weekday: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
INSERT INTO employee_fixed_off_days (user_id, company_id, weekday) VALUES
  -- Managers
  ('95a8ea6e-6646-4da9-8277-0edbd8a32baf', '5049135a-656a-4848-bf66-6faba6a2e877', 0), -- Aaron: Sun off
  ('95a8ea6e-6646-4da9-8277-0edbd8a32baf', '5049135a-656a-4848-bf66-6faba6a2e877', 6), -- Aaron: Sat off
  ('c099f56c-439e-4f9a-8312-f108cdbca5c5', '5049135a-656a-4848-bf66-6faba6a2e877', 0), -- David: Sun off
  ('53e44ad9-9fd5-4543-b87c-68829e357aa8', '5049135a-656a-4848-bf66-6faba6a2e877', 5), -- Ethan: Fri off
  ('53e44ad9-9fd5-4543-b87c-68829e357aa8', '5049135a-656a-4848-bf66-6faba6a2e877', 6), -- Ethan: Sat off
  ('3bc2cea1-0b19-44db-a920-0026a3247f80', '5049135a-656a-4848-bf66-6faba6a2e877', 6), -- Fiona: Sat off
  ('a21e7af6-9062-42bc-bcbd-570eba487d80', '5049135a-656a-4848-bf66-6faba6a2e877', 0), -- Jasmine: Sun off
  ('a21e7af6-9062-42bc-bcbd-570eba487d80', '5049135a-656a-4848-bf66-6faba6a2e877', 1), -- Jasmine: Mon off
  ('0e008b63-4bd2-4c88-bd1e-9d8a58a9681a', '5049135a-656a-4848-bf66-6faba6a2e877', 0), -- Marcus: Sun off
  ('abbee208-4450-4221-8fd9-8aaa331828ee', '5049135a-656a-4848-bf66-6faba6a2e877', 6), -- Rachel: Sat off
  ('a849d78d-0009-464f-99b9-8841a911010a', '5049135a-656a-4848-bf66-6faba6a2e877', 0), -- Vivian: Sun off
  ('a849d78d-0009-464f-99b9-8841a911010a', '5049135a-656a-4848-bf66-6faba6a2e877', 6), -- Vivian: Sat off
  -- Employees
  ('f7e37388-97e5-4a2f-a8a8-c668416638d5', '5049135a-656a-4848-bf66-6faba6a2e877', 0), -- Ben: Sun off
  ('f7e37388-97e5-4a2f-a8a8-c668416638d5', '5049135a-656a-4848-bf66-6faba6a2e877', 6), -- Ben: Sat off
  ('445a296e-51ed-46ba-b0d2-70e13cbe22a3', '5049135a-656a-4848-bf66-6faba6a2e877', 0), -- Chloe: Sun off
  ('6def3b79-8377-4132-977d-a09c29cfbd7d', '5049135a-656a-4848-bf66-6faba6a2e877', 5), -- Daniel: Fri off
  ('6def3b79-8377-4132-977d-a09c29cfbd7d', '5049135a-656a-4848-bf66-6faba6a2e877', 6), -- Daniel: Sat off
  ('bd334271-0e01-4d7a-a95a-422dc8b8ad88', '5049135a-656a-4848-bf66-6faba6a2e877', 0), -- Elaine: Sun off
  ('7d2a50d1-7bbf-4ec6-ae38-1903a4e65521', '5049135a-656a-4848-bf66-6faba6a2e877', 6), -- Felix: Sat off
  ('c36227ce-df9d-4a28-83e6-cd4379d9dea7', '5049135a-656a-4848-bf66-6faba6a2e877', 0), -- Grace: Sun off
  ('c36227ce-df9d-4a28-83e6-cd4379d9dea7', '5049135a-656a-4848-bf66-6faba6a2e877', 1), -- Grace: Mon off
  ('8ee59110-994b-4250-a992-556f0bb3c4c8', '5049135a-656a-4848-bf66-6faba6a2e877', 0), -- Henry: Sun off
  ('4e0fc4b2-5ff4-40bf-931f-1b5bb11b0c16', '5049135a-656a-4848-bf66-6faba6a2e877', 6); -- Irene: Sat off

-- ── STEP 4: Leave requests ────────────────────────────────────────────────────
INSERT INTO time_off_requests (company_id, requester_id, request_type, reason, status) VALUES
  ('5049135a-656a-4848-bf66-6faba6a2e877', 'bd334271-0e01-4d7a-a95a-422dc8b8ad88', 'time_off', 'Family holiday',      'approved'),
  ('5049135a-656a-4848-bf66-6faba6a2e877', '445a296e-51ed-46ba-b0d2-70e13cbe22a3', 'time_off', 'Medical appointment', 'pending'),
  ('5049135a-656a-4848-bf66-6faba6a2e877', '6def3b79-8377-4132-977d-a09c29cfbd7d', 'time_off', 'Personal matter',     'approved'),
  ('5049135a-656a-4848-bf66-6faba6a2e877', '95a8ea6e-6646-4da9-8277-0edbd8a32baf', 'time_off', 'Vacation',            'approved'),
  ('5049135a-656a-4848-bf66-6faba6a2e877', 'a21e7af6-9062-42bc-bcbd-570eba487d80', 'time_off', 'Flu',                 'pending'),
  ('5049135a-656a-4848-bf66-6faba6a2e877', '7d2a50d1-7bbf-4ec6-ae38-1903a4e65521', 'time_off', 'Rest day swap',       'rejected');
