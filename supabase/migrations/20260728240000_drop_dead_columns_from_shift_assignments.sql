-- assignment_status: default 'assigned' on every row (242/242 live rows verified), never once
-- transitioned by any write path — 'accepted'/'rejected'/'completed' are unreachable dead states.
alter table public.shift_assignments drop column assignment_status;

-- updated_at: only one write site sets it and the caller never reads the return value; zero read
-- sites anywhere in the app.
alter table public.shift_assignments drop column updated_at;

-- assigned_cw_id: superseded by supervisor_employee_id (the reverse mechanism, see
-- employeeDashboardRepository.ts comment) — 0/242 live rows have a value, no code references it.
alter table public.shift_assignments drop column assigned_cw_id;
