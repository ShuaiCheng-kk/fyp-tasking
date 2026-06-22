-- UC9 Create Split Shift: link two non-contiguous time-block shift rows on the same day.
alter table public.shifts
  add column if not exists split_group_id uuid null;

create index if not exists shifts_split_group_id_idx on public.shifts (split_group_id);
