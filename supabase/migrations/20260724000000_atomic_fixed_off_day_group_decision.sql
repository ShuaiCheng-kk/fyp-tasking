-- Bug: Owner "modify" on a weekly Fixed Day Off submission (decideFixedOffDayRequestGroup)
-- reassigns request_date on several sibling rows of the same user at once. Because each row was
-- updated via its own separate REST call (effectively its own transaction) and the unique
-- constraint (user_id, request_date) is checked immediately, a batch that shuffles dates among
-- rows that already belong to that user (e.g. swapping which of Mon/Tue/Thu/Fri/Sun is the day
-- off) hits "duplicate key value violates unique constraint
-- employee_off_day_requests_user_id_request_date_key" even though the final set of dates has no
-- collisions — the row being written still collides with a sibling row that hasn't been updated
-- yet. Fix: make the constraint deferrable and do the whole group's updates inside one
-- Postgres function call (one transaction), so the constraint is only checked at the end once
-- every row has its final date.

alter table public.employee_off_day_requests
  drop constraint employee_off_day_requests_user_id_request_date_key;

alter table public.employee_off_day_requests
  add constraint employee_off_day_requests_user_id_request_date_key
  unique (user_id, request_date) deferrable initially deferred;

create or replace function public.decide_fixed_off_day_request_group(
  p_ids uuid[],
  p_statuses text[],
  p_request_dates date[], -- null element = keep the row's existing request_date
  p_reviewer_id uuid,
  p_reviewed_at timestamptz
)
returns setof public.employee_off_day_requests
language plpgsql
as $$
declare
  i int;
begin
  for i in 1 .. array_length(p_ids, 1) loop
    update public.employee_off_day_requests
    set status = p_statuses[i],
        reviewed_by = p_reviewer_id,
        reviewed_at = p_reviewed_at,
        request_date = coalesce(p_request_dates[i], request_date)
    where id = p_ids[i];
  end loop;

  return query
    select * from public.employee_off_day_requests where id = any(p_ids);
end;
$$;
