-- Every registration/invite-acceptance path now requires phone/DOB/photo at submit time
-- (route-level validation added alongside this migration) — backfill any pre-existing null rows
-- (e.g. platform admin accounts created directly by the seed script) before enforcing NOT NULL so
-- the constraint doesn't fail on historical data.
-- phone_number is unique (varchar(20)), so a shared literal placeholder would collide across
-- multiple null rows — derive a distinct one per row from its id instead (truncated to fit).
update public.users set phone_number = coalesce(phone_number, left(id::text, 20)) where phone_number is null;
update public.users set date_of_birth = coalesce(date_of_birth, '2000-01-01') where date_of_birth is null;
update public.users set profile_photo_url = coalesce(profile_photo_url, '') where profile_photo_url is null;

alter table public.users
  alter column phone_number set not null,
  alter column date_of_birth set not null,
  alter column profile_photo_url set not null;
