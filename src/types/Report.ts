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
  // Real labor cost: assignee hourly_rate × hours (casual workers: actual clocked hours;
  // internal staff: scheduled shift hours — they don't clock).
  labor_cost: number
  // Assignments that had no assignee hourly rate (surfaced, never guessed).
  uncosted_assignments: number
  total_shifts: number
  total_assignments: number
  total_tasks: number
  total_hires: number
  // ── Internal (Manager + Employee) attendance — Casual Workers excluded. Counted per
  // attendance record (a person working 5 days contributes 5 records), on ended, non-rejected
  // shift assignments only. on_time = Present / (Present+Late+Absent); late/absent are the same
  // denominator so the three percentages sum to 100.
  on_time_attendance_rate: number | null
  on_time_attendance_late_rate: number | null
  on_time_attendance_absent_rate: number | null
  // % of internal-staff (Manager+Employee) tasks completed on/before their deadline, among tasks
  // whose DEADLINE (not created date) falls inside the selected period. Casual Worker tasks
  // excluded. Distinct from on_time_completion_rate above, which is scoped by task_date/created
  // date and includes every role — that one still drives the per-department table/chart.
  on_time_task_completion_rate: number | null
  // % of requested positions filled, for job postings created in the period that have Status =
  // Closed only (still-open postings excluded — the hiring outcome isn't final yet). Summed by
  // position count, not job count. Distinct from recruitment_fill_rate, which includes open postings.
  hiring_success_rate: number | null
  // Average days from a posting's created_at to the date its LAST required position was filled,
  // across postings created in the period that are fully filled (partially-filled/open excluded).
  average_time_to_fill_days: number | null
  // Casual Worker share of labor_cost (fully-attended shifts only) — duplicated from
  // casual.labor_cost so previous_overview carries it for the KPI card's trend line.
  total_casual_worker_cost: number
  // ── Casual Worker Pool Analytics — every KPI below counts each WORKER once, never per
  // shift/task/record. "Worked" = the worker had at least one countable (ended, non-rejected)
  // shift assignment in the period, whether they showed up or not.
  // % of worked casual workers who had already attended at least one shift of this company
  // before the period started (i.e. not first-time workers).
  casual_rehire_rate: number | null
  // % of worked casual workers with no late, no absence, AND every deadline-in-period task
  // completed on time (a worker with no tasks passes the task condition vacuously).
  casual_reliable_worker_rate: number | null
  // % of worked casual workers whose every attendance in the period was Present — one Late or
  // Absent record disqualifies the worker.
  casual_on_time_attendance_rate: number | null
  // % of casual workers (among those assigned ≥1 task whose deadline falls in the period) who
  // completed ALL of those tasks on or before their deadlines.
  casual_on_time_task_completion_rate: number | null
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
  // ── Internal Analytics (Company Overview drill-down blocks) — Manager+Employee, department-scoped ──
  // Same definitions as the matching ReportOverview fields, bucketed per department.
  internal_attendance_rate: number | null
  internal_attendance_late_rate: number | null
  internal_attendance_absent_rate: number | null
  internal_task_on_time_rate: number | null
  hiring_success_rate: number | null
  average_time_to_fill_days: number | null
  casual_labor_cost: number
  // ── Sample sizes behind the rates above ───────────────────────────────────
  // The bar charts plot the rate alone, so 0% over 1 task and 0% over 40 tasks render
  // identically. Anomaly detection needs the denominator to tell a real problem from a
  // rounding artefact of a tiny sample.
  // Attendance records counted for internal_attendance_* (present + late + absent).
  internal_attendance_records: number
  // Internal tasks whose deadline fell in the period — denominator of internal_task_on_time_rate.
  internal_tasks_due: number
  // Requested/hired position counts behind hiring_success_rate (same Closed-postings-only,
  // position-count-weighted basis — see ReportOverview.hiring_success_rate). Both 0 when there
  // were no closed postings, matching hiring_success_rate being null in that case.
  hiring_positions_requested: number
  hiring_positions_hired: number
}

// ── 任务负载（按人）─────────────────────────────────────────────────────────
// One row per person who was assigned at least one task during the period. Every chart on the
// report aggregates by department, so how that period's work was split BETWEEN PEOPLE appears
// nowhere in the UI — which is what makes a department that ran on one member's back detectable
// at all. This is a record of what happened, like everything else on this page; current
// workload belongs on the dashboard, not in a report.
export interface TaskWorkloadRow {
  user_id: string
  full_name: string
  role: string
  department_id: string | null
  department_name: string
  // Top-level, non-archived tasks assigned to this person in the period.
  tasks_assigned: number
  // Of those, the ones not yet Complete.
  tasks_open: number
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
  department_id: string | null
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
  profile_photo_url: string | null
  worked: number
  // Every shift assignment made to this worker in the period — including rejected ones and shifts
  // that haven't ended yet. Answers "how often was this person scheduled?", not "did they show up?".
  assigned_shifts: number
  rejected_shifts: number
  late: number
  absent: number
  // Confirmed jobs this worker cancelled during the period (job_cancellations,
  // cancelled_role='worker' only — employer-side cancels never count against the worker).
  cancellations: number
  // Deadline-in-period tasks the assigner rejected in Review at least once (tasks.rejected_at) —
  // the work-quality signal: completed is not the same as completed WELL.
  tasks_returned: number
  // ── Pool Analytics (charted "by Worker", never by department) ──────────────
  // Lifetime shifts actually attended (clocked in AND out) for this company, all-time — not
  // scoped to the selected period. Powers "Rehire Count by Worker".
  rehire_count: number
  // % of this worker's period attendance records with no lateness: (worked − late) over all
  // countable records (worked + absent). Null only when the worker has no countable record
  // (never happens for a row that made it into `workers`, since that requires worked+absent > 0).
  on_time_attendance_rate: number | null
  // % of this worker's deadline-in-period tasks completed on/before their deadline. Null when
  // the worker was assigned no such task this period.
  on_time_task_completion_rate: number | null
  skills: string | null
}

export interface WorkerSkillCount {
  skill: string
  count: number
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
  // Skill frequency across workers who worked this period — each worker counted once per skill,
  // regardless of shift count. Top skills first, remainder folded into a trailing "Other" bucket.
  skill_distribution: WorkerSkillCount[]
}

// ── 整份报告 ─────────────────────────────────────────────────────────────────
export interface CompanyReport {
  period: ReportPeriod
  // The immediately preceding period of the same length — basis for the ↑↓ trend.
  previous_period: ReportPeriod
  overview: ReportOverview
  previous_overview: ReportOverview
  departments: DepartmentPerformanceRow[]
  // Same rows for previous_period. The charts only plot the current period and the KPI cards
  // only trend company-wide totals, so a department's own period-over-period movement is
  // invisible in the UI — this is what anomaly detection compares against. Already computed
  // for previous_overview, so carrying it costs no extra query.
  previous_departments: DepartmentPerformanceRow[]
  // Per-person task load for the current period — see TaskWorkloadRow.
  workload: TaskWorkloadRow[]
  casual: CasualReport
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
