export interface Task {
  id: string
  shift_id: string | null
  company_id: string
  department_id: string
  parent_task_id: string | null
  sequence_order: number | null
  title: string
  description: string | null
  assigned_user_id: string | null
  assigned_by: string | null
  status: 'Assigned' | 'In Progress' | 'Review' | 'Complete'
  percentage_complete: number
  priority: string | null
  due_at: string | null
  task_date: string | null
  recurrence_group_id: string | null
  source_task_id: string | null
  is_archived: boolean
  is_completed: boolean
  // Set when the assigner rejects the task in Review — it returns to In Progress and the
  // assignee sees the reason as a rework notice until it is re-submitted / approved.
  rejection_reason?: string | null
  rejected_at?: string | null
  // Per-viewer: populated from task_delay_alert_reads for whichever user_id requested this task
  // (see taskService.getKanbanTasks/getTaskDelayAlerts), not a raw column — Owner and Partner each
  // dismiss the Task Delay Alert independently. Stays set until the deadline changes (editTask
  // clears every viewer's acknowledgement so a new delay window can re-alert everyone).
  delay_alert_read_at?: string | null
  // Stamped when the assigner approves the task in Review — the only path to Complete.
  completed_at?: string | null
  // Who actually clicked Approve — not always assigned_by, since Owner/Partner are peer
  // "assigner" roles and either may review a task the other assigned (assertIsTaskOwner).
  reviewed_by?: string | null
  created_at: string
  updated_at?: string
  shift_date?: string | null
  // Full assignee set for top-level tasks (assigned_user_id is the first/primary entry, kept in
  // sync). Not populated on sub-tasks — those stay single-assignee via assigned_user_id alone.
  assigned_user_ids?: string[]
  // Batch-attached alongside assigned_user_ids so every Task detail view (any role) can show
  // "Assigned By" without a separate members-list lookup.
  assigned_by_name?: string | null
  reviewed_by_name?: string | null
}

export interface TaskInput {
  shift_id?: string | null
  company_id: string
  department_id: string
  parent_task_id?: string | null
  sequence_order?: number | null
  title: string
  description?: string | null
  assigned_user_id?: string | null
  assigned_by?: string | null
  status?: 'Assigned' | 'In Progress' | 'Review' | 'Complete'
  percentage_complete?: number
  priority?: string | null
  due_at?: string | null
  task_date?: string | null
  recurrence_group_id?: string | null
  source_task_id?: string | null
  is_archived?: boolean
  is_completed?: boolean
  rejection_reason?: string | null
  rejected_at?: string | null
  completed_at?: string | null
  reviewed_by?: string | null
  // Full desired assignee set. When provided, assigned_user_id is derived as the first entry and
  // every id is validated against the same one-level-down role check. Omit for single-assignee
  // behavior identical to today.
  assigned_user_ids?: string[]
}

export interface SubTaskInput {
  title: string
  description?: string | null
  assigned_user_id?: string | null
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

export type TaskRecurrenceRule = 'daily' | 'weekly' | 'custom'

export type TaskDeadlineRuleType = 'same_day' | 'fixed_day' | 'relative'

export interface TaskDeadlineRule {
  type: TaskDeadlineRuleType
  time?: string                    // 'HH:mm', required for same_day and fixed_day
  weekday?: number                 // 0=Sun..6=Sat, required for fixed_day only
  offset_amount?: number           // required for relative
  offset_unit?: 'hours' | 'days'   // required for relative
}

export interface TaskRecurrenceInput {
  recurrence_rule: TaskRecurrenceRule
  recurrence_end_date: string
  custom_interval_days?: number
  assigned_by?: string
  deadline_rule?: TaskDeadlineRule
}

export interface TaskCalendarItem extends Task {
  calendar_date: string
}

export interface TaskWorkloadSuggestion {
  type: 'balanced' | 'rebalance'
  message: string
  department_id?: string
  overloaded_user_id?: string
  recommended_user_id?: string
  suggested_task_id?: string
  suggested_task_title?: string
  reason?: string
  score_gap_before?: number
  score_gap_after?: number
  // Weighted score (priority x deadline urgency), not a raw task count — a person with 5 low-
  // priority, no-rush tasks can score lower than someone with 1 urgent, overdue task.
  overloaded_score?: number
  recommended_score?: number
}

export interface TaskReassignmentSuggestion {
  task_id: string
  current_assignee_id: string | null
  recommended_assignee_id: string | null
  reason: string
}

export interface TaskDelayAlert {
  task_id: string
  title: string
  status: Task['status']
  // How much of the assigned-to-deadline window has elapsed, as a percentage (50 = halfway,
  // 100 = exactly at the deadline, >100 = overdue). Alerts fire for tasks still sitting in
  // Assigned once this passes the company's configurable threshold (default 50).
  percent_elapsed: number
  message: string
}

export interface TaskDelayAlertSettings {
  threshold_percent: number
}
