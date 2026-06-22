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
  task_date: string | null
  created_at: string
  updated_at?: string
  shift_date?: string | null
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
  task_date?: string | null
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

export type TaskRecurrenceRule = 'daily' | 'weekly' | 'custom'

export interface TaskRecurrenceInput {
  recurrence_rule: TaskRecurrenceRule
  recurrence_end_date: string
  assigned_by?: string
}

export interface TaskCalendarItem extends Task {
  calendar_date: string
}

export interface TaskWorkloadSuggestion {
  type: 'balanced' | 'rebalance'
  message: string
  overloaded_user_id?: string
  recommended_user_id?: string
  overloaded_count?: number
  recommended_count?: number
}

export interface TaskReassignmentSuggestion {
  task_id: string
  current_assignee_id: string | null
  recommended_assignee_id: string | null
  reason: string
}

export interface StalledTaskAlert {
  task_id: string
  title: string
  status: Task['status']
  days_since_update: number
  message: string
}
