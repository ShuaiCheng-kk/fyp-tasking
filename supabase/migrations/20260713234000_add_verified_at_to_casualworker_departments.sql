-- A Casual Worker only counts as a *verified* member of the company's worker pool once they've
-- actually completed a shift (clocked in AND out) — not just at recruitment two-way-confirm time,
-- which happens before they've ever shown up and doesn't guarantee they won't no-show.
-- NULL = confirmed but never completed a shift yet. Non-null = first completed clock-out.
alter table public.casualworker_departments
  add column verified_at timestamptz null;
