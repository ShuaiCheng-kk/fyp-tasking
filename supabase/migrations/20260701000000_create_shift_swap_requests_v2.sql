-- Shift Swap Requests (v2): bilateral swap where both parties have a shift.
-- Flow: requester proposes → counterpart confirms → owner/manager approves.
-- Both shifts are locked while a pending request exists (enforced at service layer).

-- Drop old table if it exists (old schema only had one shift, no counterpart confirmation)
drop table if exists public.shift_swap_requests cascade;

create table public.shift_swap_requests (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies(id) on delete cascade,

  -- The person who initiates the swap
  requester_id            uuid not null references public.users(id) on delete cascade,
  -- Requester's shift assignment they want to give away
  requester_assignment_id uuid not null references public.shift_assignments(id) on delete cascade,

  -- The person being asked to swap
  counterpart_id          uuid not null references public.users(id) on delete cascade,
  -- Counterpart's shift assignment they would give to requester
  counterpart_assignment_id uuid not null references public.shift_assignments(id) on delete cascade,

  -- Optional note from requester
  reason                  text,

  -- Step 1: counterpart must agree before it goes to owner
  counterpart_status      text not null default 'pending'
    check (counterpart_status in ('pending', 'approved', 'rejected')),
  counterpart_reviewed_at timestamptz,

  -- Step 2: owner/manager final decision (only set after counterpart approves)
  status                  text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by             uuid references public.users(id),
  reviewed_at             timestamptz,

  -- AI recommendation cache
  ai_recommendation       text,   -- 'approve' | 'not_recommended'
  ai_reason               text,   -- full formatted reasoning text

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Each shift assignment can only have ONE active pending swap request at a time
create unique index shift_swap_one_pending_per_requester_assignment
  on public.shift_swap_requests (requester_assignment_id)
  where status = 'pending';

create unique index shift_swap_one_pending_per_counterpart_assignment
  on public.shift_swap_requests (counterpart_assignment_id)
  where status = 'pending';

create index shift_swap_requests_company_id_idx on public.shift_swap_requests (company_id);
create index shift_swap_requests_requester_id_idx on public.shift_swap_requests (requester_id);
create index shift_swap_requests_counterpart_id_idx on public.shift_swap_requests (counterpart_id);
