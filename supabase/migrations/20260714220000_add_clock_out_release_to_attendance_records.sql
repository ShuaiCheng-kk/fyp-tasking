-- One-off (open-ended) jobs have no scheduled end time, so Clock Out has no natural time gate.
-- Instead, the supervising Employee must review the work and explicitly release the Casual
-- Worker before they can clock out. Fixed-end shifts are unaffected — they keep the existing
-- time-based gate and these columns stay null.
alter table attendance_records
  add column if not exists clock_out_released_by uuid references users(id),
  add column if not exists clock_out_released_at timestamptz;
