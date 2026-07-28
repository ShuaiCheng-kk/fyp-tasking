-- from_user_id -> user_id: the "from_" prefix was redundant once department_id (the
-- audience/recipient scope) got its own clearer name below; announcements only ever
-- has one user reference (the poster), so a plain user_id is unambiguous.
-- department_id -> audience_department_id: this column has never meant "poster's
-- department" (see 20260728023150_document_announcement_department_id.sql) — it is
-- who the announcement is scoped to (NULL = company-wide, non-null = that department).
-- The old name read like ownership metadata; the new name states the audience meaning
-- directly instead of relying on a column comment to explain it.

alter table public.announcements
  rename column from_user_id to user_id;

alter table public.announcements
  rename column department_id to audience_department_id;

alter table public.announcements
  rename constraint announcements_from_user_id_fkey to announcements_user_id_fkey;

alter table public.announcements
  rename constraint announcements_department_id_fkey to announcements_audience_department_id_fkey;

comment on column public.announcements.audience_department_id is
  'Audience scope for this announcement. NULL = company-wide (Owner/Partner only). Non-null = scoped to that department (Managers can only post to their own department_id).';
