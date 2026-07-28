export type WaitingOnYouItemId =
  | 'shift_swap'
  | 'off_day_deadline'
  | 'job_posting_approval'
  | 'applicant_accept'
  | 'task_review'

export interface WaitingOnYouItem {
  id: WaitingOnYouItemId
  label: string
  count: number
  // ISO timestamp of the oldest pending item, for an "oldest Xh/Xd" chip. Null when count is 0.
  oldest_at: string | null
  // Extra context shown in the chip/row, e.g. the off-day deadline's target week label.
  detail: string | null
}

export interface TaskOverviewRow {
  id: string
  title: string
  priority: string | null
  assignee_name: string
  assignee_photo_url: string | null
  department_id: string | null
  department_name: string | null
  due_at: string | null
  // Completion stamp (completed_at, falling back to updated_at) — only meaningful for rows in
  // the Completed group.
  completed_at: string | null
}

export type TaskOverviewGroupKey = 'overdue' | 'delay_alert' | 'completed' | 'due_today' | 'due_this_week'

export interface TaskOverviewGroup {
  key: TaskOverviewGroupKey
  label: string
  count: number
  tasks: TaskOverviewRow[]
}

export interface AttendancePersonRow {
  user_id: string
  name: string
  // Shift start wall-clock, 'HH:MM' — also the grouping key for the Not Started column.
  shift_start: string
  // Formatted actual clock-in, e.g. '08:17 AM'. Null unless status is present or late.
  clock_in_label: string | null
  // Whole minutes past shift start. Null unless status is late.
  minutes_late: number | null
}

export interface AttendanceDepartmentGroup {
  department_id: string | null
  department_name: string
  expected: number
  checked_in: number
  present: AttendancePersonRow[]
  late: AttendancePersonRow[]
  not_started: AttendancePersonRow[]
  absent: AttendancePersonRow[]
}

export interface AttendanceRoleGroup {
  expected: number
  checked_in: number
  departments: AttendanceDepartmentGroup[]
}

export interface AttendanceOverview {
  internal: AttendanceRoleGroup
  casual: AttendanceRoleGroup
}

export interface RecruitmentDeadlineRow {
  job_id: string
  title: string
  confirmed_count: number
  openings: number
}

export interface RecruitmentStartingSoonRow extends RecruitmentDeadlineRow {
  job_date: string
  days_until_start: number
}

export interface RecruitmentOverview {
  deadline_today: RecruitmentDeadlineRow[]
  starting_soon: RecruitmentStartingSoonRow[]
}

export type TaskNotificationId = 'new_assigned_task' | 'task_rejected' | 'shift_swap_rejected'

export interface TaskNotificationItem {
  id: TaskNotificationId
  label: string
  count: number
  oldest_at: string | null
  detail: string | null
}

export interface TeamOverview {
  managers: number
  employees: number
  casual_worker_pool: number
}

export interface OwnerDashboardSummary {
  task_notifications: TaskNotificationItem[]
  waiting_on_you: WaitingOnYouItem[]
  task_overview: TaskOverviewGroup[]
  attendance_overview: AttendanceOverview
  recruitment_overview: RecruitmentOverview
  team_overview: TeamOverview
}
