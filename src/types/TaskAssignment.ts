export interface TaskAssignment {
  id: string
  task_id: string
  user_id: string
  assigned_by: string | null
}

export interface TaskAssignmentInput {
  task_id: string
  user_id: string
  assigned_by: string | null
}
