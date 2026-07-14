-- The applicant's tracker shows WHEN each step of the hiring journey happened, but until now only
-- the first two moments were recorded: job_applicants.applied_at (they applied) and
-- job_invitations.sent_at (the employer accepted them and the offer went out). Every later
-- transition just flipped a status column and lost its timestamp.
--
-- decided_at  — when the APPLICATION itself reached its outcome: the employer rejected it, or the
--               job filled up and closed it out ('job_closed'), or the employer removed a confirmed
--               worker. (Employer acceptance isn't stamped here — that moment already lives on the
--               invitation as sent_at.)
-- responded_at — when the OFFER reached its outcome: the worker confirmed or declined it, or the
--               system voided it because another worker claimed the last opening / the shift began.

alter table public.job_applicants
  add column if not exists decided_at timestamptz;

alter table public.job_invitations
  add column if not exists responded_at timestamptz;

comment on column public.job_applicants.decided_at is
  'When this application was resolved by the employer/system (rejected, job_closed, cancelled_by_employer). Null while pending or accepted.';

comment on column public.job_invitations.responded_at is
  'When this offer was resolved (worker accepted/declined, or system marked it expired/position_filled/cancelled). Null while still sent.';
