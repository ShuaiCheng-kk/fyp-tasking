-- Add optional user-selectable representative color to departments
alter table public.departments
add column if not exists color text;
