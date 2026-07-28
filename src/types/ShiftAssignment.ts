export interface ShiftAssignment {
  id: string
  shift_id: string
  user_id: string
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
