export interface Task {
  id: string
  shift_id: string | null
  company_id: string
  department_id: string
  parent_task_id: string | null
  title: string
  description: string | null
  assigned_user_id: string | null
  assigned_by: string | null
  status: 'Assigned' | 'In Progress' | 'Review' | 'Complete'
  percentage_complete: number
  priority: string | null
  due_at: string | null
  created_at: string
  updated_at?: string
}

export interface TaskInput {
  shift_id?: string | null
  company_id: string
  department_id: string
  parent_task_id?: string | null
  title: string
  description?: string | null
  assigned_user_id?: string | null
  assigned_by?: string | null
  status?: 'Assigned' | 'In Progress' | 'Review' | 'Complete'
  percentage_complete?: number
  priority?: string | null
  due_at?: string | null
}

export interface TaskStatItem {
  id: string
  title: string
  status: string
  priority?: string | null
  percentage_complete?: number
  assignee_name?: string
  assigned_user_id?: string | null
  created_at?: string
}

export interface TaskStats {
  assigned: number
  inProgress: number
  review: number
  complete: number
  tasks?: TaskStatItem[]
}

export interface DepartmentTaskStats extends TaskStats {
  department_id: string
  department_name: string
}

export interface KanbanGroup {
  Assigned: Task[]
  'In Progress': Task[]
  Review: Task[]
  Complete: Task[]
}
