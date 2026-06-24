-- Track which shift template (if any) a shift was created from, so Edit Shift can preselect it.
alter table public.shifts
  add column if not exists template_id uuid references public.shift_templates(id) on delete set null;

create index if not exists shifts_template_id_idx
  on public.shifts (template_id);
