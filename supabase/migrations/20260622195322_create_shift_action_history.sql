-- UC11 Undo Last Shift Action: persisted history of reversible shift mutations.
create table if not exists public.shift_action_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  performed_by uuid not null references public.users(id) on delete cascade,
  action_type text not null,
  affected_shift_ids uuid[] not null,
  undo_payload jsonb not null,
  undone boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists shift_action_history_company_performed_idx
  on public.shift_action_history (company_id, performed_by, created_at desc);
