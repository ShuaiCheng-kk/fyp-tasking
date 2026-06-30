-- Add flat_rate column to shifts for One-Off Job pay display in attendance export
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS flat_rate numeric(10,2) DEFAULT NULL;
