-- Worker Profile (shared by Guest User and Casual Worker):
-- skills = free text (no preset list by design; AI does fuzzy matching),
-- resume lives on the profile and is snapshotted into each application at apply time.
alter table public.users add column if not exists skills text;
alter table public.users add column if not exists resume_url text;

-- Certificates: preset list + custom name chosen in the UI; the name is stored as-is here.
-- File upload is optional per certificate.
create table if not exists public.user_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  file_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_certificates_user_id on public.user_certificates(user_id);
