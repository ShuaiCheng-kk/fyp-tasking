import { Shift } from './Shift'
import { ShiftAssignment } from './ShiftAssignment'

export type AttendanceOwnerStatus = 'pending' | 'approved' | 'rejected' | 'modified'
export type AttendanceExceptionType = 'pending' | 'late' | 'absent' | 'overtime'
export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected'
export type TimeOffRequestType = 'break_waiver'

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
  employee_notes?: string | null
  manager_notes?: string | null
  status?: string
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
  ai_recommendation: string | null
  ai_reason: string | null
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
}

export interface ShiftSwapMovableTask {
  id: string
  title: string
  status: string
  priority: string | null
  due_at: string | null
}

export interface FixedOffDayRequest {
  id: string
  user_id: string
  company_id: string
  weekday: number
  status: AttendanceRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface FixedOffDayDecisionInput {
  id: string
  reviewer_id: string
  decision: AttendanceRequestStatus
}

export interface FixedOffDayRequestView extends FixedOffDayRequest {
  requester_name: string
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
