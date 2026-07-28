-- Casual Worker / Guest-only profile fields were sitting on `users`, unused for every internal
-- role (Owner/Partner/Manager/Employee). Splitting them into a 1:1 extension table keeps `users`
-- as the single identity table (still one row per person, still the join target for every FK)
-- while the CW-specific columns live somewhere that isn't full of nulls for internal roles.
create table public.casual_worker_profiles (
  user_id        uuid primary key references public.users(id) on delete cascade,
  payment_method text null,
  payment_account text null,
  skills         text null,
  resume_url     text null
);

insert into public.casual_worker_profiles (user_id, payment_method, payment_account, skills, resume_url)
select id, payment_method, payment_account, skills, resume_url
from public.users
where role in ('Casual Worker', 'Guest User');
