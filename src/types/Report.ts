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
  }
  departments: DepartmentReportRow[]
  recent_activity: Array<{
    type: 'shift' | 'task' | 'attendance'
    title: string
    detail: string
    date: string
  }>
}
