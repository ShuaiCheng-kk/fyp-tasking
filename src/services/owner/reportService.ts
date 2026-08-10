// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { reportRepository } from '@/repositories/owner/reportRepository'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { sgtInstant, sgtShiftEndInstant } from '@/lib/singaporeTime'
import { AttendanceRecord } from '@/types/Attendance'
import {
  CasualReliabilityRow,
  CompanyReport,
  DepartmentPerformanceRow,
  RecruitmentHistorySummary,
  RecruitmentPostingRow,
  ReportFilters,
  ReportOverview,
  ReportPeriod,
  TaskWorkloadRow,
} from '@/types/Report'

// Every number in this report is computed from recorded data only — no assumed hours,
// no invented multipliers, no hand-picked thresholds. When a rate has nothing to
// measure, it is null (the UI renders "no data"), never a fake 0%.

// shift_date/start_time/end_time are Singapore-nominal wall-clock values (see
// src/lib/singaporeTime) — sgtInstant resolves the real instant they represent, comparable to
// the already-UTC clock_in_time/clock_out_time timestamps (same convention as
// attendanceService.combineDateTime).
function combineDateTime(date: string, time: string): Date {
  return sgtInstant(date, time)
}

function percent(part: number, total: number): number | null {
  if (total === 0) return null
  return Math.round((part / total) * 100)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// The clock times that count are the corrected ones if a reviewer adjusted them during UC56
// (same precedence the Attendance module applies).
function effectiveClockIn(record: AttendanceRecord): string | null {
  return record.modified_clock_in_time ?? record.clock_in_time
}

function effectiveClockOut(record: AttendanceRecord): string | null {
  return record.modified_clock_out_time ?? record.clock_out_time
}

// Mirrors attendanceService.getAttendanceExceptions: absent = no clock-in by shift end
// (or clock-in after shift end); late = clock-in more than the 10-minute grace after start.
function classifyAttendance(
  shift: { shift_date: string; start_time: string; end_time: string },
  record: AttendanceRecord | null,
  now: Date,
): { absent: boolean; late: boolean; countable: boolean } {
  // BUG-021: an overnight shift's end (end_time <= start_time) falls on the following Singapore
  // calendar day — sgtShiftEndInstant resolves that, instead of treating it as same-day.
  const shiftEnd = sgtShiftEndInstant(shift.shift_date, shift.start_time, shift.end_time)
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

// Local wall-clock calendar date — same convention as taskService.formatDateKey. due_at is an
// absolute timestamp; the deadline "belongs" to whichever local day it falls on, never a UTC slice.
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  workload: TaskWorkloadRow[]
  casual: Omit<CompanyReport['casual'], 'pool'>
}

async function buildPeriodData(
  filters: ReportFilters,
  now: Date,
  departments: Awaited<ReturnType<typeof reportRepository.getDepartments>>,
  managers: Awaited<ReturnType<typeof reportRepository.getDepartmentManagers>>,
): Promise<PeriodData> {
  const [shifts, tasks, postings, deadlineTasks, workerCancellations] = await Promise.all([
    reportRepository.getShifts(filters),
    reportRepository.getTasksInRange(filters),
    reportRepository.getJobPostingsCreatedInRange(filters),
    reportRepository.getTasksByDeadlineRange(filters),
    reportRepository.getWorkerCancellationsInRange(filters.company_id, filters.date_from, isoDateAddDays(filters.date_to, 1)),
  ])

  const assignments = await reportRepository.getAssignmentsByShiftIds(shifts.map(s => s.id))
  // Task assignees for the On-time Task Completion Rate KPI aren't necessarily also shift
  // assignees in this window, so their ids are folded into the same user lookup.
  const deadlineTaskAssigneeIds = [...new Set(deadlineTasks.map(t => t.assigned_user_id).filter((id): id is string => !!id))]
  // Per-person workload counts every task in the range, whose assignee may be neither a shift
  // assignee nor a deadline-task assignee in this window — so their ids join the same lookup.
  const rangeTaskAssigneeIds = [...new Set(tasks.map(t => t.assigned_user_id).filter((id): id is string => !!id))]
  // A worker who cancelled a confirmed job may have no shift assignment at all this period —
  // their name still has to resolve for the risk list, so their ids join the lookup too.
  const cancellingUserIds = [...new Set(workerCancellations.map(c => c.user_id))]
  const combinedUserIds = [...new Set([...assignments.map(a => a.user_id).filter((id): id is string => !!id), ...deadlineTaskAssigneeIds, ...rangeTaskAssigneeIds, ...cancellingUserIds])]
  const [attendance, users, applicants, invitations] = await Promise.all([
    reportRepository.getAttendanceByAssignmentIds(assignments.map(a => a.id)),
    reportRepository.getUsersByIds(combinedUserIds),
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
      internal_attendance_rate: null,
      internal_attendance_late_rate: null,
      internal_attendance_absent_rate: null,
      internal_task_on_time_rate: null,
      hiring_success_rate: null,
      average_time_to_fill_days: null,
      casual_labor_cost: 0,
      internal_attendance_records: 0,
      internal_tasks_due: 0,
      hiring_positions_requested: 0,
      hiring_positions_hired: 0,
    }
    deptRows.set(key, row)
    return row
  }

  shifts.forEach(shift => { ensureRow(shift.department_id).shifts += 1 })

  // ── Attendance + labor cost, walked once over assignments ─────────────────
  let attendanceCountable = 0
  let attendancePresent = 0
  let internalCountable = 0
  let internalPresent = 0
  let internalLate = 0
  let internalAbsent = 0
  let laborCost = 0
  let casualLaborCost = 0
  let uncosted = 0
  const casualStats = new Map<string, CasualReliabilityRow>()
  const deptInternalAttendance = new Map<string, { present: number; late: number; absent: number }>()

  for (const assignment of assignments) {
    const shift = shiftsById.get(assignment.shift_id)
    if (!shift) continue
    const row = ensureRow(shift.department_id)
    row.assignments += 1

    // A removed member's role no longer resolves — their attendance still counts toward the
    // department's raw totals above, but the per-worker Casual/Internal breakdowns below need a
    // live role to classify into, so they're skipped for it (name/labor cost history is preserved
    // elsewhere via user_name_snapshot; this is just the per-person reliability rows).
    const user = assignment.user_id ? usersById.get(assignment.user_id) : undefined
    const isCasual = !!assignment.user_id && user?.role === 'Casual Worker'
    const isInternal = !!assignment.user_id && (user?.role === 'Manager' || user?.role === 'Employee')
    const record = recordByAssignmentId.get(assignment.id) ?? null
    const verdict = classifyAttendance(shift, record, now)

    // Casual Worker attendance drives the existing attendance_rate + per-worker reliability rows.
    if (isCasual && assignment.user_id) {
      const stats = casualStats.get(assignment.user_id) ?? {
        user_id: assignment.user_id,
        full_name: user?.full_name ?? '',
        profile_photo_url: user?.profile_photo_url ?? null,
        worked: 0,
        assigned_shifts: 0,
        rejected_shifts: 0,
        late: 0,
        absent: 0,
        cancellations: 0,
        tasks_returned: 0,
        rehire_count: 0,
        on_time_attendance_rate: null,
        on_time_task_completion_rate: null,
        skills: user?.skills ?? null,
      }
      // Every assignment counts as "requested", whatever became of it — no-show or a shift that
      // hasn't ended yet. This measures how often managers reach for this worker.
      stats.assigned_shifts += 1

      if (verdict.countable) {
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

    // Managers and Employees clock in/out against their own shift_assignment the same way
    // (employeeAttendanceService.clockIn/clockOut) — counted per attendance record, not per
    // person, per the Owner's requested On-time Attendance Rate KPI.
    if (isInternal && verdict.countable) {
      internalCountable += 1
      const deptKey = shift.department_id ?? 'none'
      const bucket = deptInternalAttendance.get(deptKey) ?? { present: 0, late: 0, absent: 0 }
      if (verdict.absent) { internalAbsent += 1; bucket.absent += 1 }
      else if (verdict.late) { internalLate += 1; bucket.late += 1 }
      else { internalPresent += 1; bucket.present += 1 }
      deptInternalAttendance.set(deptKey, bucket)
    }

    // Labor cost = money actually owed for Casual Worker shifts only — internal staff are
    // salaried, not paid per shift, so they never contribute a labor cost line. Rate comes from
    // the shift itself (set from job_postings.salary_amount at shift-creation time), not a fixed
    // rate on the worker. Nothing for a Casual Worker who never showed up (absent), never
    // completed clock-out, or whose shift hasn't ended yet. A payable assignment with no rate is
    // counted as uncosted, never guessed.
    const fullyAttended = !!(record && effectiveClockIn(record) && effectiveClockOut(record))
    const payable = isCasual && verdict.countable && !verdict.absent && fullyAttended
    if (payable) {
      let cost: number | null = null
      if (shift.hourly_rate !== null && shift.hourly_rate !== undefined) {
        cost = shift.hourly_rate * actualWorkedHours(record)
      }
      if (cost === null) {
        uncosted += 1
      } else {
        laborCost += cost
        row.labor_cost = round2(row.labor_cost + cost)
        casualLaborCost += cost
        row.casual_labor_cost = round2(row.casual_labor_cost + cost)
      }
    }
  }

  deptRows.forEach((row, key) => {
    const bucket = deptInternalAttendance.get(key)
    const total = bucket ? bucket.present + bucket.late + bucket.absent : 0
    row.internal_attendance_records = total
    row.internal_attendance_rate = bucket ? percent(bucket.present, total) : null
    row.internal_attendance_late_rate = bucket ? percent(bucket.late, total) : null
    row.internal_attendance_absent_rate = bucket ? percent(bucket.absent, total) : null
  })

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
  // ── Per-person task load ───────────────────────────────────────────────────
  // Bucketed by assignee, not department: how the period's work was divided between people is
  // what this product is for, and every chart on the report aggregates it away.
  const workloadByUser = new Map<string, TaskWorkloadRow>()
  for (const task of topLevelTasks) {
    if (!task.assigned_user_id) continue
    const user = usersById.get(task.assigned_user_id)
    if (!user) continue
    const row = workloadByUser.get(task.assigned_user_id) ?? {
      user_id: task.assigned_user_id,
      full_name: user.full_name,
      role: user.role,
      department_id: task.department_id ?? null,
      department_name: task.department_id ? (departmentNames.get(task.department_id) ?? 'Department') : 'No department',
      tasks_assigned: 0,
      tasks_open: 0,
    }
    row.tasks_assigned += 1
    if (task.status !== 'Complete') row.tasks_open += 1
    workloadByUser.set(task.assigned_user_id, row)
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

  // ── On-time Task Completion Rate (internal staff, deadline-range-filtered) ─────────────────
  // Denominator = Manager/Employee, top-level, non-archived tasks whose DEADLINE falls inside the
  // period — regardless of when they were created or whether they're even complete yet. Casual
  // Worker tasks excluded.
  let internalTaskDue = 0
  let internalTaskOnTime = 0
  const deptInternalTaskOnTime = new Map<string, { onTime: number; due: number }>()
  // Casual Worker task performance is judged per WORKER (pool analytics), not per task — tracked
  // as on-time/due counts so both the pass/fail Reliable Worker Rate and the continuous
  // "On-Time Task Completion Rate by Worker" chart can be derived from the same numbers.
  const casualTaskStats = new Map<string, { onTime: number; due: number; returned: number }>()
  for (const task of deadlineTasks) {
    if (task.parent_task_id || task.is_archived || !task.due_at) continue
    const dueDateKey = formatDateKey(new Date(task.due_at))
    if (dueDateKey < filters.date_from || dueDateKey > filters.date_to) continue
    const assignee = task.assigned_user_id ? usersById.get(task.assigned_user_id) : null
    if (assignee?.role === 'Casual Worker') {
      const taskOnTime = task.status === 'Complete' && !!task.completed_at
        && new Date(task.completed_at).getTime() <= new Date(task.due_at).getTime()
      const bucket = casualTaskStats.get(task.assigned_user_id!) ?? { onTime: 0, due: 0, returned: 0 }
      bucket.due += 1
      if (taskOnTime) bucket.onTime += 1
      // Work-quality signal: the assigner rejected this task in Review at least once. Same
      // once-per-task counting as the internal rework_count (a task bounced twice counts once).
      if (task.rejected_at) bucket.returned += 1
      casualTaskStats.set(task.assigned_user_id!, bucket)
      continue
    }
    if (assignee?.role !== 'Manager' && assignee?.role !== 'Employee') continue
    ensureRow(task.department_id)
    internalTaskDue += 1
    const onTime = task.status === 'Complete' && !!task.completed_at
      && new Date(task.completed_at).getTime() <= new Date(task.due_at).getTime()
    if (onTime) internalTaskOnTime += 1
    const deptKey = task.department_id ?? 'none'
    const bucket = deptInternalTaskOnTime.get(deptKey) ?? { onTime: 0, due: 0 }
    bucket.due += 1
    if (onTime) bucket.onTime += 1
    deptInternalTaskOnTime.set(deptKey, bucket)
  }
  deptRows.forEach((row, key) => {
    const bucket = deptInternalTaskOnTime.get(key)
    row.internal_tasks_due = bucket ? bucket.due : 0
    row.internal_task_on_time_rate = bucket ? percent(bucket.onTime, bucket.due) : null
  })

  // Confirmed-job cancellations, folded onto the same per-worker stats — a worker can cancel a
  // job whose shift never got assigned to them this period (or at all), so this may create a
  // stats row casualStats.assigned_shifts never touched.
  const cancellationCounts = new Map<string, number>()
  for (const c of workerCancellations) {
    cancellationCounts.set(c.user_id, (cancellationCounts.get(c.user_id) ?? 0) + 1)
  }
  for (const [userId, count] of cancellationCounts) {
    const stats = casualStats.get(userId) ?? {
      user_id: userId,
      full_name: usersById.get(userId)?.full_name ?? '',
      profile_photo_url: usersById.get(userId)?.profile_photo_url ?? null,
      worked: 0,
      assigned_shifts: 0,
      rejected_shifts: 0,
      late: 0,
      absent: 0,
      cancellations: 0,
      tasks_returned: 0,
      rehire_count: 0,
      on_time_attendance_rate: null,
      on_time_task_completion_rate: null,
      skills: usersById.get(userId)?.skills ?? null,
    }
    stats.cancellations = count
    casualStats.set(userId, stats)
  }
  // Task-quality signal, transferred onto the same rows the attendance loop already built.
  for (const [userId, taskStat] of casualTaskStats) {
    const stats = casualStats.get(userId)
    if (stats) stats.tasks_returned = taskStat.returned
  }

  // ── Casual Worker Pool Analytics — every KPI counts each worker ONCE ───────
  // "Worked" = at least one countable (ended) shift assignment in the period;
  // an absent-only worker still belongs to this period's pool (casualStats.worked counts
  // attended shifts, casualStats.absent counts no-shows — either > 0 means they were used).
  // A worker who only cancelled (no attended/absent shift this period) is surfaced separately by
  // the "Workers Needing Attention" list, not folded into this population.
  const workedCasuals = [...casualStats.values()].filter(s => s.worked + s.absent > 0)
  // Rehired = already attended (clocked in on) a shift of this company before the period —
  // i.e. before their first worked shift inside the range — so not a first-time worker.
  const priorAttendedIds = new Set(await reportRepository.getPriorAttendedCasualUserIds(
    filters.company_id,
    workedCasuals.map(s => s.user_id),
    filters.date_from,
  ))
  const rehiredWorkers = workedCasuals.filter(s => priorAttendedIds.has(s.user_id)).length
  // On-time = every attendance in the period Present: no Late, no Absent.
  const onTimeAttendanceWorkers = workedCasuals.filter(s => s.late === 0 && s.absent === 0).length
  // Reliable = no late + no absence + all deadline-in-period tasks completed on time
  // (no tasks assigned = the task condition passes vacuously).
  const reliableWorkers = workedCasuals.filter(s => {
    const taskStat = casualTaskStats.get(s.user_id)
    const tasksOk = !taskStat || taskStat.onTime === taskStat.due
    return s.late === 0 && s.absent === 0 && tasksOk
  }).length
  // Task KPI has its own denominator: workers assigned ≥1 task whose deadline is in the period.
  const casualTaskWorkers = casualTaskStats.size
  const casualTaskOnTimeWorkers = [...casualTaskStats.values()].filter(t => t.onTime === t.due).length

  // Per-worker continuous rates + lifetime rehire count — these power the "by Worker" charts
  // (Pool Analytics KPI cards above are pass/fail; the charts show the underlying distribution).
  const lifetimeCompletedShifts = await reportRepository.getLifetimeCompletedShiftsByUserIds(
    filters.company_id,
    workedCasuals.map(s => s.user_id),
  )
  const lifetimeByUserId = new Map(lifetimeCompletedShifts.map(r => [r.user_id, r.completed_shifts]))
  for (const stats of workedCasuals) {
    stats.rehire_count = lifetimeByUserId.get(stats.user_id) ?? 0
    stats.on_time_attendance_rate = percent(stats.worked - stats.late, stats.worked + stats.absent)
    const taskStat = casualTaskStats.get(stats.user_id)
    stats.on_time_task_completion_rate = taskStat ? percent(taskStat.onTime, taskStat.due) : null
  }

  // Worker Skill Distribution — each worked worker counted once per distinct skill (comma-split
  // free-text field), regardless of shift count. Top skills first, remainder folded into "Other".
  const skillCounts = new Map<string, { label: string; count: number }>()
  for (const stats of workedCasuals) {
    const seen = new Set<string>()
    for (const raw of (stats.skills ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
      const key = raw.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const bucket = skillCounts.get(key) ?? { label: raw, count: 0 }
      bucket.count += 1
      skillCounts.set(key, bucket)
    }
  }
  const sortedSkills = [...skillCounts.values()].sort((a, b) => b.count - a.count)
  const TOP_SKILLS = 6
  const otherSkillCount = sortedSkills.slice(TOP_SKILLS).reduce((sum, s) => sum + s.count, 0)
  const skillDistribution = [
    ...sortedSkills.slice(0, TOP_SKILLS).map(s => ({ skill: s.label, count: s.count })),
    ...(otherSkillCount > 0 ? [{ skill: 'Other', count: otherSkillCount }] : []),
  ]

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
      department_id: posting.department_id,
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

  // Hiring Success Rate: Closed postings only (still-open postings haven't reached a final
  // outcome) — summed by position count, not job count, so a 5-opening job counts 5x a 1-opening job.
  let hiringPositionsRequested = 0
  let hiringPositionsHired = 0
  const deptHiring = new Map<string, { hired: number; requested: number }>()
  for (const posting of postings) {
    if (posting.status !== 'closed') continue
    if (posting.openings === null || posting.openings <= 0) continue
    const conf = confirmedByJob.get(posting.id) ?? { count: 0, lastAt: '' }
    const hired = Math.min(conf.count, posting.openings)
    hiringPositionsRequested += posting.openings
    hiringPositionsHired += hired
    if (posting.department_id) {
      ensureRow(posting.department_id)
      const bucket = deptHiring.get(posting.department_id) ?? { hired: 0, requested: 0 }
      bucket.hired += hired
      bucket.requested += posting.openings
      deptHiring.set(posting.department_id, bucket)
    }
  }
  const hiringSuccessRate = percent(hiringPositionsHired, hiringPositionsRequested)
  deptRows.forEach((row, key) => {
    const bucket = deptHiring.get(key)
    row.hiring_success_rate = bucket ? percent(bucket.hired, bucket.requested) : null
    row.hiring_positions_requested = bucket?.requested ?? 0
    row.hiring_positions_hired = bucket?.hired ?? 0
  })

  // Average Time to Fill: mean days_to_fill across postings that reached full headcount in this
  // period (days_to_fill is already null for anything not fully filled — see the loop above).
  const filledDaysToFill = postingRows.map(p => p.days_to_fill).filter((d): d is number => d !== null)
  const averageTimeToFillDays = filledDaysToFill.length > 0
    ? round2(filledDaysToFill.reduce((sum, d) => sum + d, 0) / filledDaysToFill.length)
    : null
  const deptTimeToFill = new Map<string, number[]>()
  postings.forEach((posting, i) => {
    const days = postingRows[i].days_to_fill
    if (days === null || !posting.department_id) return
    const list = deptTimeToFill.get(posting.department_id) ?? []
    list.push(days)
    deptTimeToFill.set(posting.department_id, list)
  })
  deptRows.forEach((row, key) => {
    const days = deptTimeToFill.get(key)
    row.average_time_to_fill_days = days && days.length > 0
      ? round2(days.reduce((sum, d) => sum + d, 0) / days.length)
      : null
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
      on_time_attendance_rate: percent(internalPresent, internalCountable),
      on_time_attendance_late_rate: percent(internalLate, internalCountable),
      on_time_attendance_absent_rate: percent(internalAbsent, internalCountable),
      on_time_task_completion_rate: percent(internalTaskOnTime, internalTaskDue),
      hiring_success_rate: hiringSuccessRate,
      average_time_to_fill_days: averageTimeToFillDays,
      total_casual_worker_cost: round2(casualLaborCost),
      casual_rehire_rate: percent(rehiredWorkers, workedCasuals.length),
      casual_reliable_worker_rate: percent(reliableWorkers, workedCasuals.length),
      casual_on_time_attendance_rate: percent(onTimeAttendanceWorkers, workedCasuals.length),
      casual_on_time_task_completion_rate: percent(casualTaskOnTimeWorkers, casualTaskWorkers),
    },
    departments: [...deptRows.values()].sort((a, b) =>
      (b.assignments + b.tasks_total) - (a.assignments + a.tasks_total),
    ),
    workload: [...workloadByUser.values()].sort((a, b) => b.tasks_assigned - a.tasks_assigned),
    casual: {
      funnel: { applied: totalApplied, accepted: totalAccepted, confirmed: totalConfirmed },
      fill_rate: percent(openingsFilled, openingsTotal),
      postings: postingRows,
      workers,
      labor_cost: round2(casualLaborCost),
      skill_distribution: skillDistribution,
    },
  }
}

export const reportService = {
  async getCompanyReport(filters: ReportFilters): Promise<CompanyReport> {
    const now = new Date()
    const period: ReportPeriod = { date_from: filters.date_from, date_to: filters.date_to }
    const prev = previousPeriod(period)

    // Departments and their managers don't depend on the date range at all, so fetching them
    // separately inside each of the two buildPeriodData calls (current period, previous period)
    // ran the identical company-wide query twice for no reason - found via Performance NFR
    // testing (20 concurrent Report page loads were queuing on the DB connection pool). Fetched
    // once here and passed into both instead.
    const [departments, managers] = await Promise.all([
      reportRepository.getDepartments(filters.company_id),
      reportRepository.getDepartmentManagers(filters.company_id),
    ])

    const [current, previous, pool] = await Promise.all([
      buildPeriodData(filters, now, departments, managers),
      buildPeriodData({ ...filters, date_from: prev.date_from, date_to: prev.date_to }, now, departments, managers),
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
      previous_departments: previous.departments,
      workload: current.workload,
      casual: { ...current.casual, pool: poolRows },
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
