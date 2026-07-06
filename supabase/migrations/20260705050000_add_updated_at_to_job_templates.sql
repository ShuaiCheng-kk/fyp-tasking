-- Track when a job template was last edited, shown on the template card in the UI.
alter table public.job_templates
  add column if not exists updated_at timestamptz not null default now();
