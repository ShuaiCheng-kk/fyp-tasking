-- user_certificates is already scoped to certificates specifically — no need for the generic
-- "file" wording on its one file column.
alter table public.user_certificates rename column file_url to certificate_url;
