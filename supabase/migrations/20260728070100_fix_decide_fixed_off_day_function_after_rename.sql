-- The previous migration (20260728070000) renamed employee_off_day_requests -> off_day_requests
-- and request_date -> requested_date, but ALTER TABLE ... RENAME does not rewrite the body of
-- plpgsql functions that reference the old names as literal SQL text — decide_fixed_off_day_
-- request_group was left calling a table/column that no longer exist. Recreate it against the
-- new names. The constraint keeps working under its old literal name (Postgres doesn't require
-- constraint names to match table/column names), but it's renamed here too for consistency.

alter table public.off_day_requests
  rename constraint employee_off_day_requests_user_id_request_date_key
  to off_day_requests_user_id_requested_date_key;

create or replace function public.decide_fixed_off_day_request_group(
  p_ids uuid[],
  p_statuses text[],
  p_request_dates date[], -- null element = keep the row's existing requested_date
  p_reviewer_id uuid,
  p_reviewed_at timestamptz
)
returns setof public.off_day_requests
language plpgsql
as $$
declare
  i int;
begin
  for i in 1 .. array_length(p_ids, 1) loop
    update public.off_day_requests
    set status = p_statuses[i],
        reviewed_by = p_reviewer_id,
        reviewed_at = p_reviewed_at,
        requested_date = coalesce(p_request_dates[i], requested_date)
    where id = p_ids[i];
  end loop;

  return query
    select * from public.off_day_requests where id = any(p_ids);
end;
$$;
