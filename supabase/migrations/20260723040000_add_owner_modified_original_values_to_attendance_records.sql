-- Pairs with owner_modified_fields: for each field name in that array, the value it held
-- immediately before the current 'modified' decision overwrote it. Lets the Owner/Partner page
-- show "Original: <value>" next to a Manager-corrected field, not just that it changed.
alter table public.attendance_records
  add column if not exists owner_modified_original_values jsonb;
