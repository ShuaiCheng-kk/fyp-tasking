export interface ShiftAssignment {
  id: string
  shift_id: string
  // Null once the assigned user has been removed from the company — the assignment row itself
  // is kept (it's historical schedule/payroll data), see user_name_snapshot below.
  user_id: string | null
  // Full name of the assigned user, captured at removal time so the assignment stays readable
  // once user_id goes null. Null while the user is still an active member.
  user_name_snapshot: string | null
  assigned_by: string
  supervisor_employee_id: string | null
  created_at: string
}

export interface ShiftAssignmentInput {
  shift_id: string
  user_id: string
  assigned_by: string
  supervisor_employee_id?: string | null
}
