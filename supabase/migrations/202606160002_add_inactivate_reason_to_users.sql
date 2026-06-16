-- Add inactivate_reason column to users table for Casual Worker status tracking
alter table public.users
add column if not exists inactivate_reason text;

-- Create index for faster queries filtering by worker_status
create index if not exists idx_users_worker_status on public.users(worker_status) where role = 'Casual Worker';
