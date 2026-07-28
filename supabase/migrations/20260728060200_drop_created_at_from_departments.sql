-- Never used for ordering (findByCompanyId has no ORDER BY) or display (the department list
-- sorts by name client-side) — a decorative column from table creation.
alter table public.departments
  drop column if exists created_at;
