import { Shift } from './Shift'
import { ShiftAssignment } from './ShiftAssignment'

export type AttendanceExceptionType = 'late' | 'absent' | 'overtime'
export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected' | 'modified'

export type AttendanceModifiedTimeField = 'clock_in_time' | 'clock_out_time' | 'break_in_time' | 'break_out_time'

export interface AttendanceRecord {
  id: string
  shift_assignment_id: string
  // Whoever clocked in for this record — Employee, Manager, or Casual Worker (all three
  // self-clock the same way). Not Casual-Worker-exclusive despite the name. Null once that
  // user has been removed from the company — the record itself is kept for payroll/history,
  // see user_name_snapshot below.
  user_id: string | null
  // Full name of the clocking-in user, captured at removal time so the record stays readable
  // once user_id goes null. Null while the user is still an active member.
  user_name_snapshot: string | null
  clock_in_time: string | null
  clock_out_time: string | null
  break_in_time: string | null
  break_out_time: string | null
  // Corrected values if a reviewer edited them. The raw columns above are never overwritten, so
  // they always hold the true original — comparing each pair at minute precision is how the UI
  // derives "was this field modified" without a separate stored flag.
  modified_clock_in_time: string | null
  modified_clock_out_time: string | null
  modified_break_in_time: string | null
  modified_break_out_time: string | null
  // Reason given when a reviewer corrects a time. Required whenever any modified_* value ends up
  // differing from its raw counterpart.
  modified_reason: string | null
  // Who last corrected this record's times — Owner, Partner, or a Manager (scoped to their own
  // department's Employee/Casual Worker records) — and when.
  modified_by: string | null
  modified_at: string | null
  // Open-ended (one-off) jobs have no scheduled end time, so the supervising Employee must
  // review the work and set this true before the Casual Worker is allowed to clock out. Unused
  // for fixed-end shifts, which keep the time-based gate instead.
  clock_out_released: boolean
}

export interface AttendanceRecordUpdate {
  clock_in_time?: string | null
  clock_out_time?: string | null
  break_in_time?: string | null
  break_out_time?: string | null
  modified_clock_in_time?: string | null
  modified_clock_out_time?: string | null
  modified_break_in_time?: string | null
  modified_break_out_time?: string | null
  modified_reason?: string | null
  modified_by?: string | null
  modified_at?: string | null
  clock_out_released?: boolean
}

export interface AttendanceRecordCreate {
  shift_assignment_id: string
  user_id: string
  clock_in_time: string | null
  clock_out_time?: string | null
  break_in_time?: string | null
  break_out_time?: string | null
}

export interface CasualAttendanceShift {
  assignment: ShiftAssignment
  shift: Shift
  record: AttendanceRecord | null
}

export interface CasualAttendanceOverview {
  user: {
    id: string
    full_name: string
    role: string
  }
  shifts: CasualAttendanceShift[]
  message: string
}

// Correcting a clock/break time — the only action a reviewer can take on an attendance record.
// Whether anything actually changed (and which fields) is derived by comparing the submitted
// times to each field's true original, not tracked as a separate decision/status.
export interface AttendanceModifyTimesInput {
  id: string
  actor_id: string
  reason?: string | null
  clock_in_time?: string | null
  clock_out_time?: string | null
  break_in_time?: string | null
  break_out_time?: string | null
}

export interface AttendanceDashboardRecord {
  assignment: ShiftAssignment
  shift: Shift
  assignee_name: string
  assignee_role: string
  assignee_profile_photo_url: string | null
  assignee_worker_status: string | null
  assignee_hourly_rate: number | null
  supervisor_name: string | null
  department_name: string | null
  // The job posting title for a Casual Worker's shift (source_job_posting_id join) — internal
  // staff shifts have no posting, so this is always null for them.
  job_title: string | null
  record: AttendanceRecord | null
  exceptions: AttendanceExceptionType[]
  // Who/when record.modified_by last corrected this record — the Attendance/Shifts pages use
  // this alongside the live modified-vs-raw diff to flag a correction with the "M" badge.
  modifier_name: string | null
  modifier_role: string | null
}

export interface AttendanceDashboard {
  records: AttendanceDashboardRecord[]
  summary: {
    total_assignments: number
    late: number
    absent: number
    overtime: number
  }
}


export type ShiftSwapCounterpartStatus = 'pending' | 'approved' | 'rejected'
export type ShiftSwapStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface ShiftSwapRequest {
  id: string
  company_id: string
  requester_id: string
  requester_assignment_id: string
  counterpart_id: string
  counterpart_assignment_id: string
  reason: string | null
  counterpart_status: ShiftSwapCounterpartStatus
  counterpart_reviewed_at: string | null
  status: ShiftSwapStatus
  reviewed_by: string | null
  reviewed_at: string | null
  owner_review_reason: string | null
  created_at: string
  updated_at: string
}

export interface ShiftSwapRequestCreateInput {
  company_id: string
  requester_id: string
  requester_assignment_id: string
  counterpart_id: string
  counterpart_assignment_id: string
  reason: string | null
}

export interface ShiftSwapCounterpartDecisionInput {
  id: string
  counterpart_id: string
  decision: ShiftSwapCounterpartStatus
}

export interface ShiftSwapOwnerDecisionInput {
  id: string
  reviewer_id: string
  decision: 'approved' | 'rejected'
  // Required by the UI when decision is 'rejected' — recorded as owner_review_reason so the
  // requester (and the Completed Requests list) can see why the Owner/Partner rejected it.
  reason?: string | null
}

export interface ShiftSwapWithdrawInput {
  id: string
  requester_id: string
}

export interface ShiftSwapRequestView extends ShiftSwapRequest {
  requester_name: string
  requester_role: string
  requester_photo_url: string | null
  counterpart_name: string
  counterpart_role: string
  counterpart_photo_url: string | null
  reviewer_name: string | null
  department_name: string | null
  // Requester's shift info
  requester_shift_title: string | null
  requester_shift_date: string | null
  requester_start_time: string | null
  requester_end_time: string | null
  // Counterpart's shift info
  counterpart_shift_title: string | null
  counterpart_shift_date: string | null
  counterpart_start_time: string | null
  counterpart_end_time: string | null
  // Task counts (for AI impact report)
  requester_task_count: number
  counterpart_task_count: number
  // Active (non-Complete, non-archived) tasks that will move to the other party if approved
  requester_movable_tasks: ShiftSwapMovableTask[]
  counterpart_movable_tasks: ShiftSwapMovableTask[]
  // Live rule check for the reviewer, evaluated when the queue is read (NOT the stored
  // accept-time verdict — settings may have been configured after the request arrived).
  // null/undefined = that rule isn't configured, so there is nothing to comply with.
  monthly_swap_limit?: number | null
  requester_swaps_left?: number | null
  counterpart_swaps_left?: number | null
  limit_exceeded?: boolean | null
  deadline_exceeded?: boolean | null
}

export interface ShiftSwapMovableTask {
  id: string
  title: string
  description: string | null
  status: string
  priority: string | null
  due_at: string | null
  created_at: string
}

// Shared rule shape evaluated at counterpart-accept time — same fields whether the row being
// enforced is the company-wide Owner/Partner config or a department-scoped Manager config below.
// null monthly_swap_limit / deadline_hours_before_shift means "nothing to enforce".
// require_review_on_* pick the action when that rule is breached: true = escalate (to Owner for
// a Manager-Manager swap, to the department's Manager for an Employee-Employee swap), false =
// auto-reject the request. Rules are evaluated when the counterpart accepts, not at submission
// (the monthly count / deadline may change while the request waits).
export interface ShiftSwapRuleConfig {
  auto_approval_enabled: boolean
  monthly_swap_limit: number | null
  deadline_hours_before_shift: number | null
  require_review_on_limit_exceeded: boolean
  require_review_on_deadline_exceeded: boolean
}

// Company-wide config, Owner/Partner-only. Governs Manager<->Manager swaps only — Employee<->
// Employee swaps use ShiftSwapDepartmentSettings instead (confirmed 2026-07-23: Owner/Partner
// only ever review a Manager's own swap, so their settings scope stops there too).
export interface ShiftSwapSettings extends ShiftSwapRuleConfig {
  company_id: string
  updated_by: string | null
  updated_at: string
}

export interface ShiftSwapSettingsUpsertInput extends ShiftSwapRuleConfig {
  company_id: string
  updated_by: string
}

// Per-department config, owned by that department's Manager(s). Governs Employee<->Employee
// swaps within that one department only — never other departments', and never Manager swaps.
export interface ShiftSwapDepartmentSettings extends ShiftSwapRuleConfig {
  company_id: string
  department_id: string
  updated_by: string | null
  updated_at: string
}

export interface ShiftSwapDepartmentSettingsUpsertInput extends ShiftSwapRuleConfig {
  company_id: string
  department_id: string
  updated_by: string
}

export type FixedOffDaySource = 'submitted' | 'auto_assigned'

// A day-off/rest entitlement must be granted somewhere — Owner/Partner can relocate it to a
// different date but can never deny the request outright, so 'rejected' is not a valid decision
// here (it stays in AttendanceRequestStatus only as a historical status on old rows).
export type FixedOffDayDecision = 'approved' | 'modified'

export interface FixedOffDayRequest {
  id: string
  user_id: string
  company_id: string
  requested_date: string
  requested_week: string
  status: AttendanceRequestStatus
  source: FixedOffDaySource
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface FixedOffDayDecisionInput {
  id: string
  reviewer_id: string
  decision: FixedOffDayDecision
  // Required when decision is 'modified' — the replacement date for this single row.
  new_date?: string
}

// One weekly submission (a Manager/Employee's set of requested off-days for one week) is stored
// as one row per date, but is decided on as a single unit — approving/modifying applies to every
// row in the group at once.
export interface FixedOffDayDecisionGroupInput {
  ids: string[]
  reviewer_id: string
  decision: FixedOffDayDecision
  // Required when decision is 'modified' — replacement dates paired 1:1 with ids by array index.
  new_dates?: string[]
}

export interface FixedOffDayCreateInput {
  user_id: string
  company_id: string
  dates: string[]
}

export interface FixedOffDayRequestView extends FixedOffDayRequest {
  requester_name: string
  requester_role: string
  reviewer_name: string | null
  department_id: string | null
}

export type OffDayQuotaDefaultRole = 'Manager' | 'Employee'

export interface OffDayQuotaSetting {
  company_id: string
  user_id: string | null
  max_days_per_week: number
  role: OffDayQuotaDefaultRole | null
}

export interface OffDayQuotaUpsertInput {
  company_id: string
  user_id: string | null
  max_days_per_week: number
  role: OffDayQuotaDefaultRole | null
}

export interface OffDaySubmissionDeadline {
  company_id: string
  deadline_weekday: number
  deadline_time: string
}

export interface OffDaySubmissionDeadlineUpsertInput {
  company_id: string
  deadline_weekday: number
  deadline_time: string
}
