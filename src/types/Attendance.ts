import { Shift } from './Shift'
import { ShiftAssignment } from './ShiftAssignment'

export type AttendanceOwnerStatus = 'pending' | 'approved' | 'rejected' | 'modified'
export type AttendanceExceptionType = 'pending' | 'late' | 'absent' | 'overtime'
export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected' | 'modified'
export type TimeOffRequestType = 'break_waiver'

export type AttendanceModifiedTimeField = 'clock_in_time' | 'clock_out_time' | 'break_in_time' | 'break_out_time'

export interface AttendanceRecord {
  id: string
  shift_assignment_id: string
  casual_worker_id: string
  clock_in_time: string | null
  clock_out_time: string | null
  break_in_time: string | null
  break_out_time: string | null
  late_reason: string | null
  absence_reason: string | null
  attachment_url: string | null
  confirmed_by_employee_id: string
  submitted_by_employee_id: string
  status: string
  employee_notes: string | null
  manager_notes: string | null
  owner_status: AttendanceOwnerStatus
  owner_notes: string | null
  owner_reviewed_by: string | null
  owner_reviewed_at: string | null
  owner_adjusted_clock_in_time: string | null
  owner_adjusted_clock_out_time: string | null
  // Which of clock_in_time/clock_out_time/break_in_time/break_out_time the most recent 'modified'
  // decision actually changed — lets the Owner/Partner page show what a Manager's correction
  // touched (paired with owner_reviewed_by/owner_reviewed_at for who/when).
  owner_modified_fields: AttendanceModifiedTimeField[] | null
  // The value each field in owner_modified_fields held immediately before that same decision
  // overwrote it — lets the UI show "Original: <value>" next to a corrected field.
  owner_modified_original_values: Partial<Record<AttendanceModifiedTimeField, string | null>> | null
  // Open-ended (one-off) jobs have no scheduled end time, so the supervising Employee must
  // review the work and release the Casual Worker before Clock Out is allowed. Unused for
  // fixed-end shifts, which keep the time-based gate instead.
  clock_out_released_by: string | null
  clock_out_released_at: string | null
  created_at: string
  updated_at: string
}

export interface AttendanceRecordUpdate {
  clock_in_time?: string | null
  clock_out_time?: string | null
  break_in_time?: string | null
  break_out_time?: string | null
  late_reason?: string | null
  absence_reason?: string | null
  attachment_url?: string | null
  confirmed_by_employee_id?: string | null
  submitted_by_employee_id?: string | null
  owner_status?: AttendanceOwnerStatus
  owner_notes?: string | null
  owner_reviewed_by?: string | null
  owner_reviewed_at?: string | null
  owner_adjusted_clock_in_time?: string | null
  owner_adjusted_clock_out_time?: string | null
  owner_modified_fields?: AttendanceModifiedTimeField[] | null
  owner_modified_original_values?: Partial<Record<AttendanceModifiedTimeField, string | null>> | null
  employee_notes?: string | null
  manager_notes?: string | null
  status?: string
  clock_out_released_by?: string | null
  clock_out_released_at?: string | null
}

export interface AttendanceRecordCreate {
  shift_assignment_id: string
  casual_worker_id: string
  clock_in_time: string | null
  clock_out_time?: string | null
  break_in_time?: string | null
  break_out_time?: string | null
  late_reason?: string | null
  absence_reason?: string | null
  attachment_url?: string | null
  confirmed_by_employee_id: string
  submitted_by_employee_id: string
  status: string
  employee_notes?: string | null
  manager_notes?: string | null
  owner_status?: AttendanceOwnerStatus
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

export interface AttendanceManagerReviewInput {
  id: string
  manager_id: string
  manager_notes: string | null
}

export interface AttendanceReviewInput {
  id: string
  owner_id: string
  decision: AttendanceOwnerStatus
  owner_notes?: string | null
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
  record: AttendanceRecord | null
  exceptions: AttendanceExceptionType[]
  // Who last decided record.owner_status (any decision, not just 'modified') — the Owner/Partner
  // page uses this + record.owner_status === 'modified' to flag a Manager's correction.
  modifier_name: string | null
  modifier_role: string | null
}

export interface AttendanceDashboard {
  records: AttendanceDashboardRecord[]
  summary: {
    total_assignments: number
    pending_final_review: number
    approved: number
    rejected: number
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
  requires_owner_review: boolean
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
  request_date: string
  week_start: string
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
  updated_by: string | null
  updated_at: string
}

export interface OffDayQuotaUpsertInput {
  company_id: string
  user_id: string | null
  max_days_per_week: number
  role: OffDayQuotaDefaultRole | null
  updated_by: string
}

export interface OffDaySubmissionDeadline {
  company_id: string
  deadline_weekday: number
  deadline_time: string
  updated_by: string | null
  updated_at: string
}

export interface OffDaySubmissionDeadlineUpsertInput {
  company_id: string
  deadline_weekday: number
  deadline_time: string
  updated_by: string
}

// Kept for page.tsx type annotations; leave/time_off functionality has been removed.
// Pages that import this type will compile but the relevant UI sections will receive no data.
export interface TimeOffRequestView {
  id: string
  company_id: string
  requester_id: string
  requester_name: string
  shift_assignment_id: string | null
  request_type: string
  reason: string | null
  status: AttendanceRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  shift_title: string | null
  shift_date: string | null
  start_time: string | null
  end_time: string | null
}
