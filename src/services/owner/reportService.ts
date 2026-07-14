// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { reportRepository } from '@/repositories/owner/reportRepository'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { AttendanceRecord } from '@/types/Attendance'
import {
  CasualReliabilityRow,
  CompanyReport,
  DepartmentPerformanceRow,
  DepartmentReportRow,
  RecruitmentHistorySummary,
  RecruitmentPostingRow,
  ReportFilters,
  ReportOverview,
  ReportPeriod,
  WorkforceAnalyticsReport,
} from '@/types/Report'

// Every number in this report is computed from recorded data only — no assumed hours,
// no invented multipliers, no hand-picked thresholds. When a rate has nothing to
// measure, it is null (the UI renders "no data"), never a fake 0%.

// shift_date/start_time/end_time are UTC-naive strings; parse with 'Z' so they compare
// correctly against the already-UTC clock_in_time/clock_out_time timestamps
// (same convention as attendanceService.combineDateTime).
function combineDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}Z`)
}

function percent(part: number, total: number): number | null {
  if (total === 0) return null
  return Math.round((part / total) * 100)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// The clock times that count are the Owner-adjusted ones when the Owner corrected the
// record during final review (same precedence the Attendance module applies).
function effectiveClockIn(record: AttendanceRecord): string | null {
  return record.owner_adjusted_clock_in_time ?? record.clock_in_time
}

function effectiveClockOut(record: AttendanceRecord): string | null {
  return record.owner_adjusted_clock_out_time ?? record.clock_out_time
}

// Mirrors attendanceService.getAttendanceExceptions: absent = no clock-in by shift end
// (or clock-in after shift end); late = clock-in more than the 10-minute grace after start.
function classifyAttendance(
  shift: { shift_date: string; start_time: string; end_time: string },
  record: AttendanceRecord | null,
  now: Date,
): { absent: boolean; late: boolean; countable: boolean } {
  const shiftEnd = combineDateTime(shift.shift_date, shift.end_time)
  // Shifts that have not ended yet can't be judged — excluded from every attendance rate.
  if (now.getTime() <= shiftEnd.getTime()) return { absent: false, late: false, countable: false }

  const clockIn = record ? effectiveClockIn(record) : null
  if (!clockIn || new Date(clockIn).getTime() >= shiftEnd.getTime()) {
    return { absent: true, late: false, countable: true }
  }
  const shiftStart = combineDateTime(shift.shift_date, shift.start_time)
  const minutesLate = (new Date(clockIn).getTime() - shiftStart.getTime()) / 60000
  return { absent: false, late: minutesLate > 10, countable: true }
}

// Real worked hours from the attendance record: clock-out − clock-in − break.
// No clock-out (or no record) = nothing measurable = 0 hours.
function actualWorkedHours(record: AttendanceRecord | null): number {
  if (!record) return 0
  const clockIn = effectiveClockIn(record)
  const clockOut = effectiveClockOut(record)
  if (!clockIn || !clockOut) return 0
  let ms = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  if (record.break_in_time && record.break_out_time) {
    ms -= new Date(record.break_out_time).getTime() - new Date(record.break_in_time).getTime()
  }
  return ms > 0 ? ms / 3600000 : 0
}

function scheduledHours(shift: { shift_date: string; start_time: string; end_time: string }): number {
  const ms = combineDateTime(shift.shift_date, shift.end_time).getTime()
    - combineDateTime(shift.shift_date, shift.start_time).getTime()
  return ms > 0 ? ms / 3600000 : 0
}

function shiftDays(period: ReportPeriod): number {
  const from = new Date(`${period.date_from}T00:00:00Z`).getTime()
  const to = new Date(`${period.date_to}T00:00:00Z`).getTime()
  return Math.round((to - from) / 86400000) + 1
}

function isoDateAddDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// The immediately preceding window of the same length: 7/7–7/13 compares against 6/30–7/6.
export function previousPeriod(period: ReportPeriod): ReportPeriod {
  const len = shiftDays(period)
  const prevTo = isoDateAddDays(period.date_from, -1)
  return { date_from: isoDateAddDays(prevTo, -(len - 1)), date_to: prevTo }
}

interface PeriodData {
  overview: ReportOverview
  departments: DepartmentPerformanceRow[]
  casual: Omit<CompanyReport['casual'], 'pool'>
}

async function buildPeriodData(filters: ReportFilters, now: Date): Promise<PeriodData> {
  const [departments, managers, shifts, tasks, postings] = await Promise.all([
    reportRepository.getDepartments(filters.company_id),
    reportRepository.getDepartmentManagers(filters.company_id),
    reportRepository.getShifts(filters),
    reportRepository.getTasksInRange(filters),
    reportRepository.getJobPostingsCreatedInRange(filters),
  ])

  const assignments = await reportRepository.getAssignmentsByShiftIds(shifts.map(s => s.id))
  const [attendance, users, applicants, invitations] = await Promise.all([
    reportRepository.getAttendanceByAssignmentIds(assignments.map(a => a.id)),
    reportRepository.getUsersByIds([...new Set(assignments.map(a => a.user_id))]),
    reportRepository.getApplicantsByJobIds(postings.map(p => p.id)),
    reportRepository.getInvitationsByJobIds(postings.map(p => p.id)),
  ])

  const shiftsById = new Map(shifts.map(s => [s.id, s]))
  const usersById = new Map(users.map(u => [u.id, u]))
  const recordByAssignmentId = new Map(attendance.map(r => [r.shift_assignment_id, r]))
  const departmentNames = new Map(departments.map(d => [d.id, d.name]))
  const managersByDepartment = new Map<string, string[]>()
  managers.forEach(m => {
    const list = managersByDepartment.get(m.department_id) ?? []
    list.push(m.manager_name)
    managersByDepartment.set(m.department_id, list)
  })

  // ── Department rows ────────────────────────────────────────────────────────
  const deptRows = new Map<string, DepartmentPerformanceRow>()
  const ensureRow = (departmentId: string | null): DepartmentPerformanceRow => {
    const key = departmentId ?? 'none'
    const existing = deptRows.get(key)
    if (existing) return existing
    const row: DepartmentPerformanceRow = {
      department_id: departmentId,
      department_name: departmentId ? (departmentNames.get(departmentId) ?? 'Department') : 'No department',
      manager_names: departmentId ? (managersByDepartment.get(departmentId) ?? []) : [],
      shifts: 0,
      assignments: 0,
      tasks_total: 0,
      tasks_completed: 0,
      on_time_rate: null,
      rework_count: 0,
      overdue_open: 0,
      late_count: 0,
      absent_count: 0,
      labor_cost: 0,
    }
    deptRows.set(key, row)
    return row
  }

  shifts.forEach(shift => { ensureRow(shift.department_id).shifts += 1 })

  // ── Attendance + labor cost, walked once over assignments ─────────────────
  let attendanceCountable = 0
  let attendancePresent = 0
  let laborCost = 0
  let casualLaborCost = 0
  let uncosted = 0
  const casualStats = new Map<string, CasualReliabilityRow>()

  for (const assignment of assignments) {
    const shift = shiftsById.get(assignment.shift_id)
    if (!shift) continue
    const row = ensureRow(shift.department_id)
    row.assignments += 1

    const user = usersById.get(assignment.user_id)
    const isCasual = user?.role === 'Casual Worker'
    const record = recordByAssignmentId.get(assignment.id) ?? null
    const rejected = assignment.assignment_status === 'rejected'
    const verdict = classifyAttendance(shift, record, now)

    // Attendance is only judged for Casual Workers — they are the role that clocks
    // in/out (4-tier chain); internal staff have no clock records to judge.
    if (isCasual) {
      const stats = casualStats.get(assignment.user_id) ?? {
        user_id: assignment.user_id,
        full_name: user?.full_name ?? '',
        worked: 0,
        rejected_shifts: 0,
        late: 0,
        absent: 0,
      }
      if (rejected) stats.rejected_shifts += 1

      if (verdict.countable && !rejected) {
        attendanceCountable += 1
        if (verdict.absent) {
          stats.absent += 1
          row.absent_count += 1
        } else {
          attendancePresent += 1
          stats.worked += 1
          if (verdict.late) {
            stats.late += 1
            row.late_count += 1
          }
        }
      }
      casualStats.set(assignment.user_id, stats)
    }

    // Labor cost = money actually owed for work: nothing for rejected assignments, and
    // nothing for a Casual Worker who never showed up (absent) or whose shift hasn't
    // ended yet. For payable work the shift's flat rate wins when set; otherwise the
    // assignee's hourly rate × hours — actual clocked hours for Casual Workers,
    // scheduled hours for internal staff (they don't clock in this system).
    // A payable assignment with neither rate is counted as uncosted, never guessed.
    const payable = !rejected && (!isCasual || (verdict.countable && !verdict.absent))
    if (payable) {
      let cost: number | null = null
      if (shift.flat_rate !== null && shift.flat_rate !== undefined) {
        cost = shift.flat_rate
      } else if (user?.hourly_rate !== null && user?.hourly_rate !== undefined) {
        cost = user.hourly_rate * (isCasual ? actualWorkedHours(record) : scheduledHours(shift))
      }
      if (cost === null) {
        uncosted += 1
      } else {
        laborCost += cost
        row.labor_cost = round2(row.labor_cost + cost)
        if (isCasual) casualLaborCost += cost
      }
    }
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const topLevelTasks = tasks.filter(t => !t.parent_task_id && !t.is_archived)
  let onTimeDone = 0
  let dueDone = 0
  for (const task of topLevelTasks) {
    const row = ensureRow(task.department_id)
    row.tasks_total += 1
    const isComplete = task.status === 'Complete'
    if (isComplete) row.tasks_completed += 1
    if (task.rejected_at) row.rework_count += 1
    if (!isComplete && task.due_at && new Date(task.due_at).getTime() < now.getTime()) {
      row.overdue_open += 1
    }
  }
  // On-time rate needs both timestamps — computed per department over completed tasks
  // that actually had a deadline.
  const deptOnTime = new Map<string, { onTime: number; due: number }>()
  for (const task of topLevelTasks) {
    if (task.status !== 'Complete' || !task.due_at || !task.completed_at) continue
    const key = task.department_id ?? 'none'
    const bucket = deptOnTime.get(key) ?? { onTime: 0, due: 0 }
    bucket.due += 1
    if (new Date(task.completed_at).getTime() <= new Date(task.due_at).getTime()) bucket.onTime += 1
    deptOnTime.set(key, bucket)
    dueDone += 1
    if (new Date(task.completed_at).getTime() <= new Date(task.due_at).getTime()) onTimeDone += 1
  }
  deptRows.forEach((row, key) => {
    const bucket = deptOnTime.get(key)
    row.on_time_rate = bucket ? percent(bucket.onTime, bucket.due) : null
  })

  // ── Recruitment ────────────────────────────────────────────────────────────
  const applicantsByJob = new Map<string, { total: number; accepted: number }>()
  for (const applicant of applicants) {
    const bucket = applicantsByJob.get(applicant.job_id) ?? { total: 0, accepted: 0 }
    bucket.total += 1
    if (applicant.status === 'accepted') bucket.accepted += 1
    applicantsByJob.set(applicant.job_id, bucket)
  }
  const confirmedByJob = new Map<string, { count: number; lastAt: string }>()
  for (const invitation of invitations) {
    if (invitation.status !== 'accepted') continue
    const bucket = confirmedByJob.get(invitation.job_id) ?? { count: 0, lastAt: '' }
    bucket.count += 1
    const confirmedAt = invitation.responded_at ?? invitation.sent_at
    if (confirmedAt > bucket.lastAt) bucket.lastAt = confirmedAt
    confirmedByJob.set(invitation.job_id, bucket)
  }

  let openingsTotal = 0
  let openingsFilled = 0
  let totalApplied = 0
  let totalAccepted = 0
  let totalConfirmed = 0
  const postingRows: RecruitmentPostingRow[] = postings.map(posting => {
    const app = applicantsByJob.get(posting.id) ?? { total: 0, accepted: 0 }
    const conf = confirmedByJob.get(posting.id) ?? { count: 0, lastAt: '' }
    totalApplied += app.total
    totalAccepted += app.accepted
    totalConfirmed += conf.count

    let daysToFill: number | null = null
    if (posting.openings !== null && posting.openings > 0) {
      openingsTotal += posting.openings
      openingsFilled += Math.min(conf.count, posting.openings)
      if (conf.count >= posting.openings && conf.lastAt) {
        daysToFill = round2(
          (new Date(conf.lastAt).getTime() - new Date(posting.created_at).getTime()) / 86400000,
        )
      }
    }
    return {
      posting_id: posting.id,
      title: posting.title,
      department_name: posting.department_id ? (departmentNames.get(posting.department_id) ?? null) : null,
      status: posting.status,
      openings: posting.openings,
      applicants: app.total,
      accepted: app.accepted,
      confirmed: conf.count,
      days_to_fill: daysToFill,
      created_at: posting.created_at,
    }
  })

  // ── Assemble ───────────────────────────────────────────────────────────────
  const workers = [...casualStats.values()].sort((a, b) =>
    (b.absent + b.late + b.rejected_shifts) - (a.absent + a.late + a.rejected_shifts)
    || b.worked - a.worked,
  )

  return {
    overview: {
      attendance_rate: percent(attendancePresent, attendanceCountable),
      on_time_completion_rate: percent(onTimeDone, dueDone),
      recruitment_fill_rate: percent(openingsFilled, openingsTotal),
      labor_cost: round2(laborCost),
      uncosted_assignments: uncosted,
      total_shifts: shifts.length,
      total_assignments: assignments.length,
      total_tasks: topLevelTasks.length,
      total_hires: totalConfirmed,
    },
    departments: [...deptRows.values()].sort((a, b) =>
      (b.assignments + b.tasks_total) - (a.assignments + a.tasks_total),
    ),
    casual: {
      funnel: { applied: totalApplied, accepted: totalAccepted, confirmed: totalConfirmed },
      fill_rate: percent(openingsFilled, openingsTotal),
      postings: postingRows,
      workers,
      labor_cost: round2(casualLaborCost),
    },
  }
}

export const reportService = {
  async getCompanyReport(filters: ReportFilters): Promise<CompanyReport> {
    const now = new Date()
    const period: ReportPeriod = { date_from: filters.date_from, date_to: filters.date_to }
    const prev = previousPeriod(period)

    const [current, previous, pool] = await Promise.all([
      buildPeriodData(filters, now),
      buildPeriodData({ ...filters, date_from: prev.date_from, date_to: prev.date_to }, now),
      recruitmentRepository.getVerifiedPoolWorkers(filters.company_id),
    ])

    const poolRows = pool
      .filter(worker => !filters.department_id || worker.department_id === filters.department_id)
      .slice(0, 8)
      .map(worker => ({
        user_id: worker.id,
        full_name: worker.full_name,
        completed_shifts: worker.completed_shifts,
        last_worked_date: worker.last_worked_date,
        skills: worker.skills,
      }))

    return {
      period,
      previous_period: prev,
      overview: current.overview,
      previous_overview: previous.overview,
      departments: current.departments,
      casual: { ...current.casual, pool: poolRows },
    }
  },

  // ── LEGACY — old report shape still served to the Partner/Manager report pages.
  // Delete (with the legacy repository methods and /api/report/recruitment) when
  // those pages inherit the new CompanyReport view.

  async getWorkforceAnalytics(filters: ReportFilters): Promise<WorkforceAnalyticsReport> {
    const [departments, shifts, tasks, timeOffRows, swapRows] = await Promise.all([
      reportRepository.getDepartments(filters.company_id),
      reportRepository.getShifts(filters),
      reportRepository.getTasks(filters),
      reportRepository.getTimeOffRequests(filters.company_id, filters.date_from, filters.date_to),
      reportRepository.getSwapRequests(filters.company_id, filters.date_from, filters.date_to),
    ])

    const assignments = await reportRepository.getAssignmentsByShiftIds(shifts.map(s => s.id))
    const attendance = await reportRepository.getAttendanceByAssignmentIds(assignments.map(a => a.id))

    const shiftsById = new Map(shifts.map(s => [s.id, s]))
    const departmentNames = new Map(departments.map(d => [d.id, d.name]))
    const rows = new Map<string, DepartmentReportRow>()

    const ensureRow = (departmentId: string | null): DepartmentReportRow => {
      const key = departmentId ?? 'none'
      const existing = rows.get(key)
      if (existing) return existing
      const row: DepartmentReportRow = {
        department_id: departmentId,
        department_name: departmentId ? (departmentNames.get(departmentId) ?? 'Department') : 'No department',
        shifts: 0,
        assignments: 0,
        tasks: 0,
        completed_tasks: 0,
        attendance_records: 0,
        approved_attendance: 0,
        rejected_attendance: 0,
      }
      rows.set(key, row)
      return row
    }

    shifts.forEach(shift => ensureRow(shift.department_id).shifts += 1)
    assignments.forEach(assignment => {
      const shift = shiftsById.get(assignment.shift_id)
      ensureRow(shift?.department_id ?? null).assignments += 1
    })
    tasks.forEach(task => {
      const row = ensureRow(task.department_id)
      row.tasks += 1
      if (task.status === 'Complete' || task.percentage_complete >= 100) row.completed_tasks += 1
    })

    const assignmentsById = new Map(assignments.map(a => [a.id, a]))
    const attendanceByAssignmentId = new Map(attendance.map(r => [r.shift_assignment_id, r]))

    attendance.forEach(record => {
      const assignment = assignmentsById.get(record.shift_assignment_id)
      const shift = assignment ? shiftsById.get(assignment.shift_id) : null
      const row = ensureRow(shift?.department_id ?? null)
      row.attendance_records += 1
      if (record.owner_status === 'approved' || record.status === 'owner_approved') row.approved_attendance += 1
      if (record.owner_status === 'rejected' || record.status === 'owner_rejected') row.rejected_attendance += 1
    })

    let lateCount = 0
    let absentCount = 0
    let overtimeCount = 0
    for (const assignment of assignments) {
      const shift = shiftsById.get(assignment.shift_id)
      const record = attendanceByAssignmentId.get(assignment.id)
      if (!record || !record.clock_in_time) {
        absentCount += 1
      } else if (shift) {
        const clockIn = new Date(record.clock_in_time).getTime()
        if (clockIn > combineDateTime(shift.shift_date, shift.start_time).getTime()) lateCount += 1
        if (record.clock_out_time
          && new Date(record.clock_out_time).getTime() > combineDateTime(shift.shift_date, shift.end_time).getTime()) {
          overtimeCount += 1
        }
      }
    }

    const completed = tasks.filter(t => t.status === 'Complete' || t.percentage_complete >= 100).length

    return {
      summary: {
        shifts: shifts.length,
        assignments: assignments.length,
        tasks: tasks.length,
        completed_tasks: completed,
        task_completion_rate: percent(completed, tasks.length) ?? 0,
        attendance_records: attendance.length,
        approved_attendance: attendance.filter(r => r.owner_status === 'approved' || r.status === 'owner_approved').length,
        rejected_attendance: attendance.filter(r => r.owner_status === 'rejected' || r.status === 'owner_rejected').length,
        pending_attendance: attendance.filter(r => r.owner_status === 'pending').length,
        late_attendance: lateCount,
        absent_count: absentCount,
        overtime_count: overtimeCount,
      },
      task_breakdown: {
        assigned: tasks.filter(t => t.status === 'Assigned' || !t.status).length,
        in_progress: tasks.filter(t => t.status === 'In Progress').length,
        review: tasks.filter(t => t.status === 'Review').length,
        complete: completed,
      },
      hr_requests: {
        time_off_pending: timeOffRows.filter(r => r.status === 'pending').length,
        time_off_approved: timeOffRows.filter(r => r.status === 'approved').length,
        time_off_rejected: timeOffRows.filter(r => r.status === 'rejected').length,
        swap_pending: swapRows.filter(r => r.status === 'pending').length,
        swap_approved: swapRows.filter(r => r.status === 'approved').length,
        swap_rejected: swapRows.filter(r => r.status === 'rejected').length,
      },
      departments: [...rows.values()].sort((a, b) => (b.assignments + b.tasks) - (a.assignments + a.tasks)),
      recent_activity: [
        ...shifts.slice(0, 5).map(s => ({
          type: 'shift' as const,
          title: s.title || 'Shift',
          detail: `${departmentNames.get(s.department_id) ?? 'No department'} · ${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`,
          date: s.shift_date,
        })),
        ...tasks.slice(0, 5).map(t => ({
          type: 'task' as const,
          title: t.title,
          detail: `${t.status} · ${t.percentage_complete}% complete`,
          date: t.created_at,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    }
  },

  async getRecruitmentHistory(filters: ReportFilters): Promise<RecruitmentHistorySummary> {
    const postings = await recruitmentRepository.getClosedPostingsByDateRange(
      filters.company_id,
      filters.date_from,
      filters.date_to,
    )
    if (postings.length === 0) {
      return { total_postings: 0, total_applicants: 0, accepted: 0, rejected: 0, conversion_rate: 0, postings: [] }
    }

    const postingIds = postings.map(p => p.id)
    const deptIds = [...new Set(postings.map(p => p.department_id).filter(Boolean) as string[])]

    const [applicantRows, deptRows] = await Promise.all([
      recruitmentRepository.getApplicantCounts(postingIds),
      recruitmentRepository.getDepartmentsByIds(deptIds),
    ])

    const deptMap = new Map(deptRows.map(d => [d.id, d.name]))
    const countByPosting = new Map<string, { total: number; accepted: number; rejected: number }>()
    for (const row of applicantRows) {
      const existing = countByPosting.get(row.job_id) ?? { total: 0, accepted: 0, rejected: 0 }
      existing.total += 1
      if (row.status === 'accepted') existing.accepted += 1
      if (row.status === 'rejected') existing.rejected += 1
      countByPosting.set(row.job_id, existing)
    }

    let totalApplicants = 0
    let totalAccepted = 0
    let totalRejected = 0

    const rows = postings.map(p => {
      const counts = countByPosting.get(p.id) ?? { total: 0, accepted: 0, rejected: 0 }
      totalApplicants += counts.total
      totalAccepted += counts.accepted
      totalRejected += counts.rejected
      return {
        posting_id: p.id,
        title: p.title,
        department_name: p.department_id ? (deptMap.get(p.department_id) ?? null) : null,
        status: p.status,
        total_applicants: counts.total,
        accepted: counts.accepted,
        rejected: counts.rejected,
        created_at: p.created_at,
      }
    })

    return {
      total_postings: postings.length,
      total_applicants: totalApplicants,
      accepted: totalAccepted,
      rejected: totalRejected,
      conversion_rate: percent(totalAccepted, totalApplicants) ?? 0,
      postings: rows,
    }
  },
}
