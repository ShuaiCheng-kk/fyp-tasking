-- Coarse home location for workers (Guest User / Casual Worker), captured at registration.
-- Region/area or postal code only — never a full street address — so future features can do
-- distance-based job matching without holding precise personal addresses. Optional.
alter table public.users add column if not exists home_location text;
