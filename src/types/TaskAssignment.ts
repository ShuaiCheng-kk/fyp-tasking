export interface TaskAssignment {
  id: string
  task_id: string
  user_id: string
  assigned_by: string | null
  created_at: string
}

export interface TaskAssignmentInput {
  task_id: string
  user_id: string
  assigned_by: string | null
}
