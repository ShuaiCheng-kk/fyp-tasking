-- Audit trail for post-confirmation exits (both directions), kept forever:
--   worker cancels their own confirmed shift  -> cancelled_role = 'worker',   scope = 'worker'
--   employer removes one confirmed worker     -> cancelled_role = 'employer', scope = 'worker'
--   employer cancels the whole job            -> cancelled_role = 'employer', scope = 'job'
-- Reason is required for employer-side cancellations (enforced in the service layer);
-- optional for worker-side. No rating system on top of this by design — history only.
create table if not exists public.recruitment_cancellations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_postings(id) on delete cascade,
  applicant_id uuid references public.job_applicants(id) on delete set null,
  cancelled_by uuid references public.users(id) on delete set null,
  cancelled_role text not null check (cancelled_role in ('worker', 'employer')),
  scope text not null check (scope in ('worker', 'job')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_recruitment_cancellations_job_id on public.recruitment_cancellations(job_id);
create index if not exists idx_recruitment_cancellations_applicant_id on public.recruitment_cancellations(applicant_id);
