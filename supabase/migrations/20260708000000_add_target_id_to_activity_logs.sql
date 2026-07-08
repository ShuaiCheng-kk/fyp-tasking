-- Link an activity log entry to the user it describes, so the UI can open
-- that member's card when the entry is clicked.
alter table public.company_activity_logs
  add column if not exists target_id uuid references public.users(id) on delete set null;
