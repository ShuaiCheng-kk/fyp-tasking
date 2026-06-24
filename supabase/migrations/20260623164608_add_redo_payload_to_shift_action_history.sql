-- UC11 Redo: store the forward state captured at undo-time so an undone action can be reapplied.
alter table public.shift_action_history
  add column if not exists redo_payload jsonb;
