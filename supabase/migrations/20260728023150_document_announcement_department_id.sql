-- department_id has a non-obvious meaning: NULL isn't "unset", it's the company-wide
-- audience. Only Owner/Partner can post with it left NULL — a Manager posting always
-- has to supply their own department_id (enforced in ownerAnnouncementService.ts),
-- so a non-null value here also implies a Manager-scoped announcement.
comment on column public.announcements.department_id is
  'Audience scope for this announcement. NULL = company-wide (Owner/Partner only). Non-null = scoped to that department (Managers can only post to their own department_id).';
