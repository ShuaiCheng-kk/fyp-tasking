-- First-come-first-served offer confirmation. Multiple invited workers can race to confirm the
-- same posting's openings; locking the job_postings row serializes the claims so the vacancy
-- count can never be oversubscribed. Returns:
--   'accepted'         — claim succeeded
--   'position_filled'  — all openings already confirmed by faster workers (invitation flipped)
--   otherwise          — the invitation's current status ('not_found' if it doesn't exist)
create or replace function public.accept_job_invitation(p_invitation_id uuid)
returns text
language plpgsql
as $$
declare
  v_job_id uuid;
  v_status text;
  v_openings integer;
  v_accepted integer;
begin
  select job_id, status into v_job_id, v_status
  from public.job_invitations
  where id = p_invitation_id;

  if not found then
    return 'not_found';
  end if;
  if v_status <> 'sent' then
    return v_status;
  end if;

  -- serialize concurrent confirmations on the same posting
  perform 1 from public.job_postings where id = v_job_id for update;

  select coalesce(openings, 1) into v_openings from public.job_postings where id = v_job_id;
  select count(*) into v_accepted
  from public.job_invitations
  where job_id = v_job_id and status = 'accepted';

  if v_accepted >= v_openings then
    update public.job_invitations set status = 'position_filled' where id = p_invitation_id;
    return 'position_filled';
  end if;

  update public.job_invitations set status = 'accepted' where id = p_invitation_id;
  return 'accepted';
end;
$$;
