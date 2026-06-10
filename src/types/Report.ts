export interface ReportFilters {
  company_id: string
  date_from: string
  date_to: string
  department_id?: string | null
}

export interface DepartmentReportRow {
  department_id: string | null
  department_name: string
  shifts: number
  assignments: number
  tasks: number
  completed_tasks: number
  attendance_records: number
  approved_attendance: number
  rejected_attendance: number
}

export interface WorkforceAnalyticsReport {
  summary: {
    shifts: number
    assignments: number
    tasks: number
    completed_tasks: number
    task_completion_rate: number
    attendance_records: number
    approved_attendance: number
    rejected_attendance: number
    pending_attendance: number
    late_attendance: number
    absent_count: number
    overtime_count: number
  }
  task_breakdown: {
    assigned: number
    in_progress: number
    review: number
    complete: number
  }
  hr_requests: {
    time_off_pending: number
    time_off_approved: number
    time_off_rejected: number
    swap_pending: number
    swap_approved: number
    swap_rejected: number
  }
  departments: DepartmentReportRow[]
  recent_activity: Array<{
    type: 'shift' | 'task' | 'attendance'
    title: string
    detail: string
    date: string
  }>
}

export interface RecruitmentHistoryRow {
  posting_id: string
  title: string
  department_name: string | null
  status: string
  total_applicants: number
  accepted: number
  rejected: number
  created_at: string
}

export interface RecruitmentHistorySummary {
  total_postings: number
  total_applicants: number
  accepted: number
  rejected: number
  conversion_rate: number
  postings: RecruitmentHistoryRow[]
}
