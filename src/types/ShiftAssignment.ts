export interface ShiftAssignment {
  id: string
  shift_id: string
  user_id: string
  assigned_by: string
  assignment_status: 'assigned' | 'accepted' | 'rejected' | 'completed'
  supervisor_employee_id: string | null
  created_at: string
  updated_at: string
}

export interface ShiftAssignmentInput {
  shift_id: string
  user_id: string
  assigned_by: string
  supervisor_employee_id?: string | null
}
