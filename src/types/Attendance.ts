import { Shift } from './Shift'
import { ShiftAssignment } from './ShiftAssignment'

export type AttendanceOwnerStatus = 'pending' | 'approved' | 'rejected' | 'modified'
export type AttendanceExceptionType = 'pending' | 'late' | 'absent' | 'overtime'
export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected'
export type TimeOffRequestType = 'time_off' | 'break_waiver'

export interface AttendanceRecord {
  id: string
  shift_assignment_id: string
  casual_worker_id: string
  clock_in_time: string | null
  clock_out_time: string | null
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

export interface TimeOffRequest {
  id: string
  company_id: string
  requester_id: string
  shift_assignment_id: string | null
  request_type: TimeOffRequestType
  reason: string | null
  status: AttendanceRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface TimeOffRequestDecisionInput {
  id: string
  reviewer_id: string
  decision: AttendanceRequestStatus
}

export interface TimeOffRequestCreateInput {
  user_id: string
  company_id: string
  request_type: TimeOffRequestType
  reason: string | null
  shift_assignment_id?: string | null
}

export interface TimeOffRequestView extends TimeOffRequest {
  requester_name: string
  shift_title: string | null
  shift_date: string | null
  start_time: string | null
  end_time: string | null
}

export interface ShiftSwapRequest {
  id: string
  company_id: string
  shift_assignment_id: string
  requester_id: string
  replacement_user_id: string
  reason: string | null
  status: AttendanceRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface ShiftSwapDecisionInput {
  id: string
  reviewer_id: string
  decision: AttendanceRequestStatus
}

export interface ShiftSwapRequestCreateInput {
  company_id: string
  shift_assignment_id: string
  requester_id: string
  replacement_user_id: string
  reason: string | null
}

export interface ShiftSwapRequestView extends ShiftSwapRequest {
  requester_name: string
  replacement_name: string
  shift_title: string | null
  shift_date: string | null
  start_time: string | null
  end_time: string | null
}
