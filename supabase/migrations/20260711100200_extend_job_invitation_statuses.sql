-- Invitation lifecycle grows beyond sent/accepted/declined:
--   expired          — not confirmed before the (next) shift start; auto-voided
--   position_filled  — vacancy filled first-come-first-served by someone else
--   cancelled        — employer removed the worker / cancelled the job before shift start
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.job_invitations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.job_invitations drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.job_invitations add constraint job_invitations_status_check
  check (status in ('sent', 'accepted', 'declined', 'expired', 'position_filled', 'cancelled'));
