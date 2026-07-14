-- The applicant tracker shows WHEN the worker confirmed a job, but confirmation happens inside
-- this RPC (the FCFS claim is atomic, so it can't be stamped from the service layer afterwards
-- without racing). Both terminal branches now record responded_at:
--   'accepted'        — this call won the claim; the worker is confirmed
--   'position_filled' — they lost the race; the last opening went to someone else
-- Behaviour is otherwise identical to 20260712090100.
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
    return 'already_' || v_status;
  end if;

  -- serialize concurrent confirmations on the same posting
  perform 1 from public.job_postings where id = v_job_id for update;

  select coalesce(openings, 1) into v_openings from public.job_postings where id = v_job_id;
  select count(*) into v_accepted
  from public.job_invitations
  where job_id = v_job_id and status = 'accepted';

  if v_accepted >= v_openings then
    update public.job_invitations
      set status = 'position_filled', responded_at = now()
      where id = p_invitation_id;
    return 'position_filled';
  end if;

  update public.job_invitations
    set status = 'accepted', responded_at = now()
    where id = p_invitation_id;
  return 'accepted';
end;
$$;
