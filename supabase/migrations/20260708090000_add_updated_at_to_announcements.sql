-- Tracks when an announcement was last edited, so the UI can show "Edited <time>"
-- instead of the original post time once an Owner/Partner/Manager updates it.
alter table public.announcements
  add column if not exists updated_at timestamptz;
