-- Half-built feature: the invite-Employee UI captures no input for this (the state variable
-- backing it is only ever reset to '', never set from a real control), so it's always sent as
-- null. Even if it held a value, redeemCode never reads it back when the invited user is
-- created. Write-only, dead end to end.
alter table public.invitation_code
  drop column if exists reporting_manager_id;
