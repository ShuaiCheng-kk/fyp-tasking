-- UC49 extension: break tracking, late/absence reasons, file attachments
-- All columns are nullable — no backfill needed for existing records.
alter table public.attendance_records
  add column if not exists break_in_time  timestamptz,
  add column if not exists break_out_time timestamptz,
  add column if not exists late_reason    text,
  add column if not exists absence_reason text,
  add column if not exists attachment_url text;

-- CW hourly rate for export pay calculation
alter table public.users
  add column if not exists hourly_rate numeric(10, 2);

-- Storage bucket for attendance attachments (MC, tickets, etc.)
insert into storage.buckets (id, name, public)
values ('attendance-attachments', 'attendance-attachments', true)
on conflict (id) do nothing;
