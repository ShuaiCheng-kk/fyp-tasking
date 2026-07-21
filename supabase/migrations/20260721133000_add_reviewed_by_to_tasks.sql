-- Owner/Partner are peer "assigner" roles that can now approve/reject a task the OTHER one
-- assigned (see taskService.assertIsTaskOwner) — so a Complete task's approver is not always
-- whoever is in assigned_by. Track the actual reviewer separately so the Task Detail view can
-- show "Reviewed by" on Complete tasks.
alter table public.tasks
  add column if not exists reviewed_by uuid references public.users(id);
