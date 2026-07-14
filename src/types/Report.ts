export interface ReportFilters {
  company_id: string
  date_from: string
  date_to: string
  department_id?: string | null
}

export interface ReportPeriod {
  date_from: string
  date_to: string
}

// ── 上·整体表现 ──────────────────────────────────────────────────────────────
// Every rate is null (not 0) when there is no data to rate — the UI shows "无数据"
// instead of a misleading 0%.
export interface ReportOverview {
  // % of casual-worker shift assignments (shift already ended) that have a clock-in.
  attendance_rate: number | null
  // % of completed tasks with a deadline that were finished on/before due_at.
  on_time_completion_rate: number | null
  // % of openings on postings created in the period that ended up confirmed (both sides accepted).
  recruitment_fill_rate: number | null
  // Real labor cost: flat_rate per assignment when the shift has one, else hourly_rate × hours
  // (casual workers: actual clocked hours; internal staff: scheduled shift hours — they don't clock).
  labor_cost: number
  // Assignments that had neither a flat rate nor an assignee hourly rate (surfaced, never guessed).
  uncosted_assignments: number
  total_shifts: number
  total_assignments: number
  total_tasks: number
  total_hires: number
}

// ── 左·部门 / Manager ────────────────────────────────────────────────────────
export interface DepartmentPerformanceRow {
  department_id: string | null
  department_name: string
  manager_names: string[]
  shifts: number
  assignments: number
  tasks_total: number
  tasks_completed: number
  on_time_rate: number | null
  rework_count: number
  overdue_open: number
  late_count: number
  absent_count: number
  labor_cost: number
}

// ── 右·临时工 ────────────────────────────────────────────────────────────────
export interface RecruitmentFunnel {
  applied: number
  accepted: number
  confirmed: number
}

export interface RecruitmentPostingRow {
  posting_id: string
  title: string
  department_name: string | null
  status: string
  openings: number | null
  applicants: number
  accepted: number
  confirmed: number
  // Days from posting creation to the last confirming acceptance — only for fully filled postings.
  days_to_fill: number | null
  created_at: string
}

export interface CasualReliabilityRow {
  user_id: string
  full_name: string
  worked: number
  rejected_shifts: number
  late: number
  absent: number
}

export interface PoolWorkerRow {
  user_id: string
  full_name: string
  completed_shifts: number
  last_worked_date: string | null
  skills: string | null
}

export interface CasualReport {
  funnel: RecruitmentFunnel
  fill_rate: number | null
  postings: RecruitmentPostingRow[]
  workers: CasualReliabilityRow[]
  pool: PoolWorkerRow[]
  labor_cost: number
}

// ── 整份报告 ─────────────────────────────────────────────────────────────────
export interface CompanyReport {
  period: ReportPeriod
  // The immediately preceding period of the same length — basis for the ↑↓ trend.
  previous_period: ReportPeriod
  overview: ReportOverview
  previous_overview: ReportOverview
  departments: DepartmentPerformanceRow[]
  casual: CasualReport
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY — old report shape still consumed by the Partner/Manager report pages.
// Owner has moved to CompanyReport above; delete this block when Partner/Manager
// inherit the new report page.
// ─────────────────────────────────────────────────────────────────────────────

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
