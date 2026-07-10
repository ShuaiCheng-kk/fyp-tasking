// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { authRepository } from '@/repositories/auth/authRepository'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { offDaySettingsRepository } from '@/repositories/owner/offDaySettingsRepository'
import { shiftSwapSettingsRepository } from '@/repositories/owner/shiftSwapSettingsRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { taskRepository } from '@/repositories/owner/taskRepository'
import { MIN_MANAGERS_PER_DAY, MIN_EMPLOYEES_PER_DAY, weekStart as computeWeekStart } from '@/lib/schedulingConstants'
import { Shift } from '@/types/Shift'
import {
  AttendanceDashboard,
  AttendanceDashboardRecord,
  AttendanceExceptionType,
  AttendanceManagerReviewInput,
  AttendanceReviewInput,
  FixedOffDayDecisionGroupInput,
  FixedOffDayDecisionInput,
  FixedOffDayRequest,
  FixedOffDayRequestView,
  ShiftSwapCounterpartDecisionInput,
  ShiftSwapOwnerDecisionInput,
  ShiftSwapRequest,
  ShiftSwapRequestCreateInput,
  ShiftSwapRequestView,
  ShiftSwapSettings,
  ShiftSwapWithdrawInput,
  TimeOffRequestView,
} from '@/types/Attendance'

// shift_date/start_time/end_time are stored as plain UTC-naive strings — without the explicit
// 'Z', `new Date(...)` parses them as local time, which produces a multi-hour skew against the
// already-UTC clock_in_time/clock_out_time timestamps on any server not running in UTC.
function combineDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}Z`)
}

// Same-day/past-day swaps are disallowed — earliest swappable shift is tomorrow. This compares
// plain calendar-day strings (both shift_date and "today" derived the same UTC-naive way) rather
// than combineDateTime, since the rule is about calendar days, not exact timestamps.
function isShiftDateExpired(shiftDate: string | null | undefined): boolean {
  if (!shiftDate) return false
  const todayStr = new Date().toISOString().slice(0, 10)
  return shiftDate <= todayStr
}

async function buildTimeOffRequestViews(requests: Awaited<ReturnType<typeof attendanceRepository.getTimeOffRequestsByCompany>>): Promise<TimeOffRequestView[]> {
  if (requests.length === 0) return []
  const userIds = [...new Set(requests.map(req => req.requester_id))]
  const assignmentIds = [...new Set(requests.map(req => req.shift_assignment_id).filter(Boolean) as string[])]
  const [users, assignmentsArr] = await Promise.all([
    attendanceRepository.getUsersByIds(userIds),
    Promise.all(assignmentIds.map(id => attendanceRepository.getShiftAssignmentById(id))),
  ])
  const usersById = indexById(users)
  const assignmentsById = new Map(assignmentsArr.filter(Boolean).map(a => [a!.id, a!]))

  return requests.map(req => {
    const assignment = req.shift_assignment_id ? assignmentsById.get(req.shift_assignment_id) : undefined
    return {
      ...req,
      requester_name: usersById.get(req.requester_id)?.full_name ?? 'Unknown',
      shift_title: assignment?.shifts?.title ?? null,
      shift_date: assignment?.shifts?.shift_date ?? null,
      start_time: assignment?.shifts?.start_time ?? null,
      end_time: assignment?.shifts?.end_time ?? null,
    } as TimeOffRequestView
  })
}

function assertShiftIsSwappable(shift: Shift, label: string) {
  if (isShiftDateExpired(shift.shift_date)) {
    throw new Error(`${label} shift must be scheduled for tomorrow or later`)
  }
}

// A pending swap becomes impossible the moment either side's shift_date arrives (assertShiftIsSwappable
// would reject the approval anyway) — auto-close it as 'rejected' as soon as anything reads it, instead
// of letting it sit in the Owner's/requester's pending queue until someone clicks it and hits an error.
async function autoExpireSwapRequestIfNeeded(request: ShiftSwapRequest): Promise<ShiftSwapRequest> {
  if (request.status !== 'pending') return request
  const [reqAss, ctrAss] = await Promise.all([
    attendanceRepository.getShiftAssignmentById(request.requester_assignment_id),
    attendanceRepository.getShiftAssignmentById(request.counterpart_assignment_id),
  ])
  const expired = isShiftDateExpired(reqAss?.shifts?.shift_date) || isShiftDateExpired(ctrAss?.shifts?.shift_date)
  if (!expired) return request
  return attendanceRepository.updateShiftSwapRequest(request.id, { status: 'rejected', reviewed_at: new Date().toISOString() })
}

// Shared by decideShiftSwapRequest (Owner/Manager approves manually) and respondShiftSwapRequest's
// auto-approval branch (both parties agreed and the request qualifies to skip Owner review).
// reviewedBy is null for the auto-approval path — there is no human reviewer to attribute it to.
async function finalizeApprovedShiftSwap(request: ShiftSwapRequest, reviewedBy: string | null): Promise<ShiftSwapRequest> {
  // Re-fetch the latest assignment/shift data — the request may have sat pending long enough
  // that a shift which was tomorrow at submit time has since become today.
  const [reqAss, ctrAss] = await Promise.all([
    attendanceRepository.getShiftAssignmentById(request.requester_assignment_id),
    attendanceRepository.getShiftAssignmentById(request.counterpart_assignment_id),
  ])
  if (!reqAss?.shifts) throw new Error('Your shift assignment not found')
  if (!ctrAss?.shifts) throw new Error('Counterpart shift assignment not found')
  assertShiftIsSwappable(reqAss.shifts, 'Your')
  assertShiftIsSwappable(ctrAss.shifts, 'The counterpart')

  // Swap the two assignments' user_id
  await attendanceRepository.updateShiftAssignmentUser(request.requester_assignment_id, request.counterpart_id)
  await attendanceRepository.updateShiftAssignmentUser(request.counterpart_assignment_id, request.requester_id)

  // Move each party's active tasks on that shift to whoever now owns the shift
  await taskRepository.reassignTasksForShiftSwap(reqAss.shift_id, request.requester_id, request.counterpart_id)
  await taskRepository.reassignTasksForShiftSwap(ctrAss.shift_id, request.counterpart_id, request.requester_id)

  return attendanceRepository.updateShiftSwapRequest(request.id, {
    status: 'approved',
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  })
}

function minutesAfter(actual: string | null, shiftDate: string, shiftTime: string): number {
  if (!actual) return 0
  const scheduled = combineDateTime(shiftDate, shiftTime)
  return Math.round((new Date(actual).getTime() - scheduled.getTime()) / 60000)
}

function getAttendanceExceptions(input: {
  shift_date: string
  start_time: string
  end_time: string
  record: { clock_in_time: string | null; clock_out_time: string | null; owner_status: string } | null
}): AttendanceExceptionType[] {
  const exceptions: AttendanceExceptionType[] = []
  const shiftEnd = combineDateTime(input.shift_date, input.end_time)
  const now = new Date()

  // Absent: no clock-in by shift end, OR clocked in after shift end (invalid clock-in)
  const clockInTime = input.record?.clock_in_time ?? null
  const clockedInAfterShiftEnd = clockInTime && new Date(clockInTime).getTime() >= shiftEnd.getTime()
  if (!clockInTime && now.getTime() > shiftEnd.getTime()) {
    exceptions.push('absent')
    return exceptions
  }
  if (clockedInAfterShiftEnd) {
    exceptions.push('absent')
    return exceptions
  }

  if (!input.record) return exceptions

  if (input.record.owner_status === 'pending') exceptions.push('pending')
  // Present window: clock-in within 10 min after shift start (grace) = not late.
  // Late: clock-in more than 10 min after shift start.
  // The grace period is also applied at clock-in time (attendanceGrace.ts) so a clock-in
  // recorded at exactly start_time can be ≤10 min after and is never flagged late.
  if (minutesAfter(clockInTime, input.shift_date, input.start_time) > 10) exceptions.push('late')
  if (minutesAfter(input.record.clock_out_time, input.shift_date, input.end_time) > 15) exceptions.push('overtime')
  return exceptions
}

function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map(row => [row.id, row]))
}

// Local-time date arithmetic (no 'Z' suffix, and formatted back out via local getters rather
// than toISOString() which would re-introduce UTC skew), matching weekStart()'s convention in
// schedulingConstants.ts — mixing UTC and local date math for the same date-key values is
// exactly the timezone-skew bug pattern already fixed elsewhere in this file (combineDateTime).
function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// deadline_weekday is stored 0(Sun)-6(Sat) per getDay() convention; weekStart is Monday-based.
// Converts the stored Sunday-start weekday into a date within the Monday-start week.
export function resolveDeadlineDateForWeek(weekStartKey: string, deadlineWeekday: number): string {
  const offsetFromMonday = (deadlineWeekday + 6) % 7
  return addDays(weekStartKey, offsetFromMonday)
}

// Combines the deadline's weekday + time-of-day into the exact instant submissions close.
// deadline_time is the wall-clock time the Owner picked in the UI, so it is parsed WITHOUT a
// 'Z' suffix — i.e. in the server's local timezone, which in dev/demo matches the user's.
// (Shift start/end times elsewhere in this file stay UTC-anchored via combineDateTime because
// they are only compared against other stored timestamps, never against a user-facing clock.)
function resolveDeadlineMoment(weekStartKey: string, deadline: { deadline_weekday: number; deadline_time: string }): Date {
  const deadlineDate = resolveDeadlineDateForWeek(weekStartKey, deadline.deadline_weekday)
  return new Date(`${deadlineDate}T${deadline.deadline_time}:00`)
}

// The week currently open for submission — normally "this week + 7", but once that window's own
// deadline (which falls inside "this week") has passed, that window is closed/auto-assigned and
// submissions shift forward to the week after, and so on. Never returns a week whose own deadline
// has already passed, so it always reflects where a fresh submission actually lands.
export function resolveActiveSubmissionWeekStart(todayKey: string, deadline: { deadline_weekday: number; deadline_time: string } | null): string {
  let candidateWeekStart = computeWeekStart(todayKey)
  for (;;) {
    const targetWeek = addDays(candidateWeekStart, 7)
    if (!deadline || Date.now() <= resolveDeadlineMoment(candidateWeekStart, deadline).getTime()) return targetWeek
    candidateWeekStart = targetWeek
  }
}

// [start, end) bounds of the current UTC calendar month, matching reviewed_at's timestamptz storage.
function currentCalendarMonthRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
  return { start, end }
}

export const SWAP_REASON_LIMIT_EXCEEDED = 'Monthly swap limit exceeded'
export const SWAP_REASON_PAST_DEADLINE = 'Submitted after deadline'

// The swap deadline is relative to the swap itself: the request must be fully agreed at least
// N hours before the EARLIEST of the two shifts starts. Checked at counterpart-accept time.
function isPastSwapDeadline(hoursBeforeShift: number, shifts: Shift[]): boolean {
  const earliestStart = Math.min(...shifts.map(s => combineDateTime(s.shift_date, s.start_time).getTime()))
  return Date.now() > earliestStart - hoursBeforeShift * 3_600_000
}

type ShiftSwapRuleVerdict =
  | { outcome: 'pass' }
  | { outcome: 'escalate' | 'reject'; reason: string }

// Evaluated when the counterpart ACCEPTS (not at submission) — the monthly count and the
// deadline can both change while the request waits for the counterpart, so the state at the
// moment both parties have agreed is the one that matters. Each rule's require_review_on_*
// setting picks what a breach does: true = escalate to the Owner (with the reason recorded),
// false = auto-reject the request outright.
async function evaluateShiftSwapRules(
  settings: ShiftSwapSettings | null,
  request: ShiftSwapRequest,
  shifts: Shift[],
): Promise<ShiftSwapRuleVerdict> {
  if (!settings) return { outcome: 'pass' }

  if (settings.monthly_swap_limit != null) {
    const { start, end } = currentCalendarMonthRange()
    const [requesterCount, counterpartCount] = await Promise.all([
      attendanceRepository.countApprovedShiftSwapsForUser(request.company_id, request.requester_id, start, end),
      attendanceRepository.countApprovedShiftSwapsForUser(request.company_id, request.counterpart_id, start, end),
    ])
    if (requesterCount >= settings.monthly_swap_limit || counterpartCount >= settings.monthly_swap_limit) {
      return { outcome: settings.require_review_on_limit_exceeded ? 'escalate' : 'reject', reason: SWAP_REASON_LIMIT_EXCEEDED }
    }
  }

  if (settings.deadline_hours_before_shift != null && isPastSwapDeadline(settings.deadline_hours_before_shift, shifts)) {
    return { outcome: settings.require_review_on_deadline_exceeded ? 'escalate' : 'reject', reason: SWAP_REASON_PAST_DEADLINE }
  }

  return { outcome: 'pass' }
}

async function resolveDepartmentIdsByUser(
  userIds: string[],
  usersById: Map<string, { role: string }>,
  company_id: string,
): Promise<Map<string, string | null>> {
  const managerIds = userIds.filter(id => usersById.get(id)?.role === 'Manager')
  const employeeIds = userIds.filter(id => usersById.get(id)?.role === 'Employee')
  const result = new Map<string, string | null>()

  await Promise.all(managerIds.map(async id => {
    const depts = await ownerTeamRepository.findManagerDepartments(id, company_id)
    result.set(id, depts[0]?.department_id ?? null)
  }))

  if (employeeIds.length > 0) {
    const employees = await attendanceRepository.getEmployeesByCompany(company_id)
    const deptByEmployee = new Map(employees.map(e => [e.id, e.department_id]))
    for (const id of employeeIds) result.set(id, deptByEmployee.get(id) ?? null)
  }

  return result
}

// Deadline-triggered auto-assignment, lazily run on-read the same way autoExpireSwapRequestIfNeeded
// closes stale swap requests — there is no cron/job-runner in this app. Fills in a full quota of
// random (staffing-safe) off-days for any Manager/Employee who submitted nothing for the upcoming
// week, once that week's submission deadline has passed. Idempotent per (company, week).
async function runAutoAssignmentSweepForUpcomingWeek(company_id: string): Promise<void> {
  const todayKey = new Date().toISOString().slice(0, 10)
  const thisWeekStart = computeWeekStart(todayKey)
  const upcomingWeekStart = addDays(thisWeekStart, 7)

  const deadline = await offDaySettingsRepository.getDeadline(company_id)
  if (!deadline) return
  if (Date.now() <= resolveDeadlineMoment(thisWeekStart, deadline).getTime()) return

  const [managers, employees, existingForWeek] = await Promise.all([
    attendanceRepository.getManagersByCompany(company_id),
    attendanceRepository.getEmployeesByCompany(company_id),
    attendanceRepository.getOffDayRequestsByCompanyAndWeek(company_id, upcomingWeekStart),
  ])
  const usersWithRows = new Set(existingForWeek.map(r => r.user_id))
  // Once everyone already has a row for the week (submitted or previously auto-assigned), there's
  // nothing left to assign — bail out before the expensive per-department-per-date headcount work
  // below, which this call would otherwise redo from scratch on every single page load for the rest
  // of the week (it was the dominant cost behind the Weekly Day Off tab feeling slow every time).
  const needsAssignment = managers.some(m => !usersWithRows.has(m.id)) || employees.some(e => !usersWithRows.has(e.id))
  if (!needsAssignment) return

  const candidateDates = Array.from({ length: 7 }, (_, i) => addDays(upcomingWeekStart, i))

  // Consumed-per-department-date headcount across this sweep run, seeded from already-scheduled
  // staff (via getScheduledHeadcountForDeptDate) and then reserved for both (a) people who already
  // submitted their own off-days before the deadline — these are locked in first — and (b) each
  // user in this sweep as they're assigned an off-day, so later users' safety checks see earlier
  // reservations from the same run.
  const consumed = new Map<string, { managers: number; employees: number }>()
  const keyOf = (departmentId: string, date: string) => `${departmentId}_${date}`

  const ensureSeeded = async (departmentId: string, date: string): Promise<{ managers: number; employees: number }> => {
    const key = keyOf(departmentId, date)
    if (!consumed.has(key)) {
      const headcount = await attendanceRepository.getScheduledHeadcountForDeptDate(company_id, departmentId, date)
      consumed.set(key, headcount)
    }
    return consumed.get(key)!
  }

  const isSafeDate = async (departmentId: string | null, role: 'Manager' | 'Employee', date: string): Promise<boolean> => {
    if (!departmentId) return true
    const current = await ensureSeeded(departmentId, date)
    if (role === 'Manager') return current.managers - 1 >= MIN_MANAGERS_PER_DAY
    return current.employees - 1 >= MIN_EMPLOYEES_PER_DAY
  }

  const markConsumed = (departmentId: string | null, role: 'Manager' | 'Employee', date: string) => {
    if (!departmentId) return
    const key = keyOf(departmentId, date)
    const current = consumed.get(key) ?? { managers: 0, employees: 0 }
    if (role === 'Manager') current.managers = Math.max(0, current.managers - 1)
    else current.employees = Math.max(0, current.employees - 1)
    consumed.set(key, current)
  }

  const managerDeptById = new Map<string, string | null>()
  await Promise.all(managers.map(async m => {
    const depts = await ownerTeamRepository.findManagerDepartments(m.id, company_id)
    managerDeptById.set(m.id, depts[0]?.department_id ?? null)
  }))

  const roleAndDeptById = new Map<string, { role: 'Manager' | 'Employee'; department_id: string | null }>()
  managers.forEach(m => roleAndDeptById.set(m.id, { role: 'Manager', department_id: managerDeptById.get(m.id) ?? null }))
  employees.forEach(e => roleAndDeptById.set(e.id, { role: 'Employee', department_id: e.department_id }))

  // Lock in already-submitted off-days first — reserve their headcount impact before checking
  // what's still safe to auto-assign to non-submitters. Rejected rows don't hold a day off.
  for (const row of existingForWeek) {
    if (row.status === 'rejected') continue
    const info = roleAndDeptById.get(row.user_id)
    if (!info?.department_id) continue
    await ensureSeeded(info.department_id, row.request_date)
    markConsumed(info.department_id, info.role, row.request_date)
  }

  const candidates: Array<{ id: string; role: 'Manager' | 'Employee'; department_id: string | null }> = [
    ...managers.filter(m => !usersWithRows.has(m.id)).map(m => ({ id: m.id, role: 'Manager' as const, department_id: managerDeptById.get(m.id) ?? null })),
    ...employees.filter(e => !usersWithRows.has(e.id)).map(e => ({ id: e.id, role: 'Employee' as const, department_id: e.department_id })),
  ].sort((a, b) => a.id.localeCompare(b.id))

  for (const candidate of candidates) {
    const quotaOverride = await offDaySettingsRepository.getQuotaForUser(company_id, candidate.id)
    const quotaDefault = quotaOverride ? null : await offDaySettingsRepository.getCompanyDefaultQuota(company_id, candidate.role)
    const maxDaysPerWeek = quotaOverride?.max_days_per_week ?? quotaDefault?.max_days_per_week ?? 2

    const safeDates: string[] = []
    for (const date of candidateDates) {
      if (await isSafeDate(candidate.department_id, candidate.role, date)) safeDates.push(date)
    }
    const shuffled = [...safeDates].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, maxDaysPerWeek)
    if (picked.length === 0) continue

    for (const date of picked) markConsumed(candidate.department_id, candidate.role, date)

    await attendanceRepository.createFixedOffDayRequests({
      user_id: candidate.id,
      company_id,
      dates: picked,
      week_start: upcomingWeekStart,
      source: 'auto_assigned',
    })
  }
}

// Shared by getAttendanceDashboard (all-time, used by AI review/anomaly detection which need to
// scan every pending record regardless of date) and getAttendanceByDateRange (UC50/UC51, which
// need just today or just a calendar month) — same assembly, different assignment source.
async function buildDashboardRecords(
  assignments: Awaited<ReturnType<typeof attendanceRepository.getAssignmentsByCompany>>,
): Promise<AttendanceDashboardRecord[]> {
  const assignmentIds = assignments.map(assignment => assignment.id)
  const records = await attendanceRepository.getAttendanceRecordsByAssignmentIds(assignmentIds)

  const userIds = new Set<string>()
  const departmentIds = new Set<string>()
  assignments.forEach(assignment => {
    userIds.add(assignment.user_id)
    if (assignment.supervisor_employee_id) userIds.add(assignment.supervisor_employee_id)
    if (assignment.shifts?.department_id) departmentIds.add(assignment.shifts.department_id)
  })
  records.forEach(record => {
    userIds.add(record.casual_worker_id)
    userIds.add(record.confirmed_by_employee_id)
    userIds.add(record.submitted_by_employee_id)
  })

  const [users, departments] = await Promise.all([
    attendanceRepository.getUsersByIds([...userIds]),
    attendanceRepository.getDepartmentsByIds([...departmentIds]),
  ])
  const usersById = indexById(users)
  const departmentsById = indexById(departments)
  const recordsByAssignment = new Map(records.map(record => [record.shift_assignment_id, record]))

  return assignments
    .filter(assignment => assignment.shifts)
    .map(assignment => {
      const shift = assignment.shifts!
      const record = recordsByAssignment.get(assignment.id) ?? null
      return {
        assignment,
        shift,
        assignee_name: usersById.get(assignment.user_id)?.full_name ?? 'Unknown member',
        assignee_role: usersById.get(assignment.user_id)?.role ?? 'Member',
        assignee_profile_photo_url: usersById.get(assignment.user_id)?.profile_photo_url ?? null,
        assignee_worker_status: usersById.get(assignment.user_id)?.worker_status ?? null,
        assignee_hourly_rate: usersById.get(assignment.user_id)?.hourly_rate ?? null,
        supervisor_name: assignment.supervisor_employee_id ? usersById.get(assignment.supervisor_employee_id)?.full_name ?? null : null,
        department_name: shift.department_id ? departmentsById.get(shift.department_id)?.name ?? null : null,
        record,
        exceptions: getAttendanceExceptions({
          shift_date: shift.shift_date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          record,
        }),
      }
    })
}

export const attendanceService = {
  async getAttendanceDashboard(company_id: string): Promise<AttendanceDashboard> {
    const assignments = await attendanceRepository.getAssignmentsByCompany(company_id)
    const dashboardRecords = await buildDashboardRecords(assignments)

    return {
      records: dashboardRecords,
      summary: {
        total_assignments: dashboardRecords.length,
        pending_final_review: dashboardRecords.filter(row => row.record?.owner_status === 'pending').length,
        approved: dashboardRecords.filter(row => row.record?.owner_status === 'approved').length,
        rejected: dashboardRecords.filter(row => row.record?.owner_status === 'rejected').length,
        late: dashboardRecords.filter(row => row.exceptions.includes('late')).length,
        absent: dashboardRecords.filter(row => row.exceptions.includes('absent')).length,
        overtime: dashboardRecords.filter(row => row.exceptions.includes('overtime')).length,
      },
    }
  },

  // UC50/UC51 — Today's ratio + timeline, and the Past Attendance Record calendar, both need
  // records scoped to an explicit date window instead of the company's entire history.
  async getAttendanceByDateRange(company_id: string, from_date: string, to_date: string): Promise<AttendanceDashboardRecord[]> {
    const assignments = await attendanceRepository.getAssignmentsByCompanyAndDateRange(company_id, from_date, to_date)
    return buildDashboardRecords(assignments)
  },

  async getTimeOffRequests(company_id: string): Promise<TimeOffRequestView[]> {
    const requests = await attendanceRepository.getTimeOffRequestsByCompany(company_id)
    return buildTimeOffRequestViews(requests)
  },

  async decideTimeOffRequest(input: { id: string; reviewer_id: string; decision: 'approved' | 'rejected' }): Promise<TimeOffRequestView> {
    if (!['approved', 'rejected'].includes(input.decision)) throw new Error('Decision must be approved or rejected')
    const request = await attendanceRepository.updateTimeOffRequest(input.id, {
      status: input.decision,
      reviewed_by: input.reviewer_id,
      reviewed_at: new Date().toISOString(),
    })
    const [view] = await buildTimeOffRequestViews([request])
    return view
  },

  async managerReviewAttendance(input: AttendanceManagerReviewInput) {
    const existing = await attendanceRepository.getAttendanceRecordById(input.id)
    if (!existing) throw new Error('Attendance record not found')
    return attendanceRepository.updateAttendanceRecord(input.id, {
      manager_notes: input.manager_notes,
      status: 'manager_reviewed',
    })
  },

  async finalReviewAttendance(input: AttendanceReviewInput) {
    const existing = await attendanceRepository.getAttendanceRecordById(input.id)
    if (!existing) throw new Error('Attendance record not found')
    if (!['approved', 'rejected', 'modified'].includes(input.decision)) {
      throw new Error('Invalid attendance decision')
    }

    return attendanceRepository.updateAttendanceRecord(input.id, {
      owner_status: input.decision,
      owner_notes: input.owner_notes ?? null,
      owner_reviewed_by: input.owner_id,
      owner_reviewed_at: new Date().toISOString(),
      owner_adjusted_clock_in_time: input.decision === 'modified' ? input.clock_in_time ?? existing.clock_in_time : existing.owner_adjusted_clock_in_time,
      owner_adjusted_clock_out_time: input.decision === 'modified' ? input.clock_out_time ?? existing.clock_out_time : existing.owner_adjusted_clock_out_time,
      status: input.decision === 'approved' ? 'owner_approved' : input.decision === 'rejected' ? 'owner_rejected' : 'owner_modified',
    })
  },

  // options.managerId absent → Owner/Partner queue (Manager<->Manager swaps only).
  // options.managerId set → that Manager's queue (Employee<->Employee swaps within their
  // managed departments only). submitShiftSwapRequest enforces both parties share a role, so
  // the requester's role alone tells us which queue a given swap belongs to.
  async getShiftSwapRequests(company_id: string, options?: { managerId?: string }): Promise<ShiftSwapRequestView[]> {
    const allRequests = await attendanceRepository.getShiftSwapRequestsByCompany(company_id)
    if (allRequests.length === 0) return []

    const assignmentIds = [...new Set(allRequests.flatMap(r => [r.requester_assignment_id, r.counterpart_assignment_id]))]
    const userIds = [...new Set(allRequests.flatMap(r => [r.requester_id, r.counterpart_id]))]

    const [assignmentsArr, users] = await Promise.all([
      attendanceRepository.getShiftAssignmentsByIds(assignmentIds),
      attendanceRepository.getUsersByIds(userIds),
    ])
    const assignmentsById = new Map(assignmentsArr.map(a => [a.id, a]))
    const usersById = indexById(users)

    // Auto-reject any pending request whose shift date has arrived — see autoExpireSwapRequestIfNeeded.
    // Assignments are already loaded above, so this reuses them instead of refetching per-request.
    await Promise.all(allRequests.map(async req => {
      if (req.status !== 'pending') return
      const expired =
        isShiftDateExpired(assignmentsById.get(req.requester_assignment_id)?.shifts?.shift_date) ||
        isShiftDateExpired(assignmentsById.get(req.counterpart_assignment_id)?.shifts?.shift_date)
      if (!expired) return
      await attendanceRepository.updateShiftSwapRequest(req.id, { status: 'rejected', reviewed_at: new Date().toISOString() })
      req.status = 'rejected'
    }))

    // Requests still waiting for the counterpart's answer are hidden from every approval queue —
    // the reviewer only sees a swap once both parties have agreed (or it's already decided).
    // Requesters still see their own awaiting requests via getMyRequests.
    let requests = allRequests.filter(req => !(req.status === 'pending' && req.counterpart_status === 'pending'))
    if (options?.managerId) {
      const managedDeptIds = new Set(
        (await ownerTeamRepository.findManagerDepartments(options.managerId, company_id)).map(d => d.department_id),
      )
      requests = requests.filter(req => {
        if (usersById.get(req.requester_id)?.role !== 'Employee') return false
        const deptId = assignmentsById.get(req.requester_assignment_id)?.shifts?.department_id
        return !!deptId && managedDeptIds.has(deptId)
      })
    } else {
      requests = requests.filter(req => usersById.get(req.requester_id)?.role !== 'Employee')
    }
    if (requests.length === 0) return []

    const scopedAssignmentIds = [...new Set(requests.flatMap(r => [r.requester_assignment_id, r.counterpart_assignment_id]))]
    const scopedShiftIds = [...new Set(scopedAssignmentIds.map(id => assignmentsById.get(id)?.shift_id).filter(Boolean) as string[])]

    const [shiftTasks, shiftMovableTasks] = await Promise.all([
      attendanceRepository.getTasksByShiftIds(scopedShiftIds),
      attendanceRepository.getMovableTasksByShiftIds(scopedShiftIds),
    ])
    // Group the flat, shift-scoped rows back per assignment (task count by shift; movable tasks
    // additionally scoped to the assignment's own user, matching getMovableTasksByShiftAssignment).
    const taskCountById = new Map(scopedAssignmentIds.map(id => {
      const shiftId = assignmentsById.get(id)?.shift_id
      return [id, shiftTasks.filter(t => t.shift_id === shiftId).length]
    }))
    const movableTasksById = new Map(scopedAssignmentIds.map(id => {
      const assignment = assignmentsById.get(id)
      const tasks = shiftMovableTasks
        .filter(t => t.shift_id === assignment?.shift_id && t.assigned_user_id === assignment?.user_id)
        .map(({ id, title, description, status, priority, due_at, created_at }) => ({ id, title, description, status, priority, due_at, created_at }))
      return [id, tasks]
    }))

    // fetch department names via requester assignment's shift department_id
    const deptIds = [...new Set(scopedAssignmentIds.map(id => assignmentsById.get(id)?.shifts?.department_id).filter(Boolean) as string[])]
    const depts = await attendanceRepository.getDepartmentsByIds(deptIds)
    const deptsById = new Map(depts.map(d => [d.id, d.name]))

    // Live rule check for the reviewer, per pending request — evaluated NOW rather than reusing
    // the accept-time verdict, because the Owner may have configured (or changed) the settings
    // after these requests arrived. Also computes each party's remaining monthly quota so the
    // reviewer can see e.g. "David 2/3 left, Rachel 0/3 left" while deciding.
    const settings = await shiftSwapSettingsRepository.getSettings(company_id)
    const swapsLeftByUser = new Map<string, number>()
    if (settings?.monthly_swap_limit != null) {
      const pendingUserIds = [...new Set(requests.filter(r => r.status === 'pending').flatMap(r => [r.requester_id, r.counterpart_id]))]
      const { start, end } = currentCalendarMonthRange()
      await Promise.all(pendingUserIds.map(async userId => {
        const used = await attendanceRepository.countApprovedShiftSwapsForUser(company_id, userId, start, end)
        swapsLeftByUser.set(userId, Math.max(0, settings.monthly_swap_limit! - used))
      }))
    }

    return requests.map(req => {
      const reqAss = assignmentsById.get(req.requester_assignment_id)
      const ctrAss = assignmentsById.get(req.counterpart_assignment_id)
      const requester = usersById.get(req.requester_id)
      const counterpart = usersById.get(req.counterpart_id)
      const deptName = deptsById.get(reqAss?.shifts?.department_id ?? '') ?? null
      const isPending = req.status === 'pending'
      const requesterSwapsLeft = isPending && settings?.monthly_swap_limit != null ? swapsLeftByUser.get(req.requester_id) ?? null : null
      const counterpartSwapsLeft = isPending && settings?.monthly_swap_limit != null ? swapsLeftByUser.get(req.counterpart_id) ?? null : null
      const ruleShifts = [reqAss?.shifts, ctrAss?.shifts].filter(Boolean) as Shift[]
      return {
        ...req,
        requester_name: requester?.full_name ?? 'Unknown',
        requester_role: requester?.role ?? '',
        requester_photo_url: requester?.profile_photo_url ?? null,
        counterpart_name: counterpart?.full_name ?? 'Unknown',
        counterpart_role: counterpart?.role ?? '',
        counterpart_photo_url: counterpart?.profile_photo_url ?? null,
        department_name: deptName,
        requester_shift_title: reqAss?.shifts?.title ?? null,
        requester_shift_date: reqAss?.shifts?.shift_date ?? null,
        requester_start_time: reqAss?.shifts?.start_time ?? null,
        requester_end_time: reqAss?.shifts?.end_time ?? null,
        counterpart_shift_title: ctrAss?.shifts?.title ?? null,
        counterpart_shift_date: ctrAss?.shifts?.shift_date ?? null,
        counterpart_start_time: ctrAss?.shifts?.start_time ?? null,
        counterpart_end_time: ctrAss?.shifts?.end_time ?? null,
        requester_task_count: taskCountById.get(req.requester_assignment_id) ?? 0,
        counterpart_task_count: taskCountById.get(req.counterpart_assignment_id) ?? 0,
        requester_movable_tasks: movableTasksById.get(req.requester_assignment_id) ?? [],
        counterpart_movable_tasks: movableTasksById.get(req.counterpart_assignment_id) ?? [],
        monthly_swap_limit: settings?.monthly_swap_limit ?? null,
        requester_swaps_left: requesterSwapsLeft,
        counterpart_swaps_left: counterpartSwapsLeft,
        limit_exceeded: isPending && settings?.monthly_swap_limit != null
          ? (requesterSwapsLeft ?? 0) <= 0 || (counterpartSwapsLeft ?? 0) <= 0
          : null,
        deadline_exceeded: isPending && settings?.deadline_hours_before_shift != null && ruleShifts.length > 0
          ? isPastSwapDeadline(settings.deadline_hours_before_shift, ruleShifts)
          : null,
      }
    })
  },

  // Owner/Manager: approve or reject after counterpart has agreed
  async decideShiftSwapRequest(input: ShiftSwapOwnerDecisionInput) {
    if (!['approved', 'rejected'].includes(input.decision)) throw new Error('Invalid swap decision')
    let request = await attendanceRepository.getShiftSwapRequestById(input.id)
    if (!request) throw new Error('Shift swap request not found')
    request = await autoExpireSwapRequestIfNeeded(request)
    if (request.status !== 'pending') throw new Error('Request is no longer pending')
    if (request.counterpart_status !== 'approved') throw new Error('Counterpart has not agreed yet')

    if (input.decision === 'approved') {
      return finalizeApprovedShiftSwap(request, input.reviewer_id)
    }

    return attendanceRepository.updateShiftSwapRequest(input.id, {
      status: input.decision,
      reviewed_by: input.reviewer_id,
      reviewed_at: new Date().toISOString(),
    })
  },

  // UC56: Approve Fixed Day Off — Manager AND Employee submissions both route to the Owner/Partner
  // queue directly (Employees are no longer reviewed by their Manager first).
  async getFixedOffDayRequests(company_id: string): Promise<FixedOffDayRequestView[]> {
    await runAutoAssignmentSweepForUpcomingWeek(company_id)

    const allRequests = await attendanceRepository.getOffDayRequestsByCompany(company_id)
    if (allRequests.length === 0) return []

    const users = await attendanceRepository.getUsersByIds([...new Set(allRequests.map(request => request.user_id))])
    const usersById = indexById(users)

    const departmentIdByUser = await resolveDepartmentIdsByUser(
      [...new Set(allRequests.map(req => req.user_id))],
      usersById,
      company_id,
    )

    return allRequests.map(request => ({
      ...request,
      requester_name: usersById.get(request.user_id)?.full_name ?? 'Unknown member',
      requester_role: usersById.get(request.user_id)?.role ?? '',
      department_id: departmentIdByUser.get(request.user_id) ?? null,
    }))
  },

  async decideFixedOffDayRequest(input: FixedOffDayDecisionInput) {
    if (!['approved', 'modified'].includes(input.decision)) throw new Error('Invalid request decision')
    const existing = await attendanceRepository.getFixedOffDayRequestById(input.id)
    if (!existing) throw new Error('Weekly day off request not found')
    if (existing.source === 'auto_assigned' && existing.status === 'approved') {
      throw new Error('This day off was auto-assigned and is already approved — nothing to decide')
    }
    if (input.decision === 'modified' && !input.new_date) {
      throw new Error('new_date is required to modify this request')
    }
    // Owner picks the replacement date freely (any week) — a request that comes back unchanged
    // (new_date === the date it already had) is really just being approved as requested, not modified.
    const unchanged = input.decision === 'modified' && input.new_date === existing.request_date

    return attendanceRepository.updateFixedOffDayRequest(input.id, {
      status: unchanged ? 'approved' : input.decision,
      reviewed_by: input.reviewer_id,
      reviewed_at: new Date().toISOString(),
      ...(input.decision === 'modified' && !unchanged ? { request_date: input.new_date } : {}),
    })
  },

  // A Manager/Employee's weekly submission is one row per requested date but decided as a single
  // unit — Owner's only two live decisions are 'approved' (as requested) or 'modified' (each row's
  // date reassigned 1:1 from new_dates, e.g. after a staffing conflict flagged by AI review).
  async decideFixedOffDayRequestGroup(input: FixedOffDayDecisionGroupInput) {
    if (!['approved', 'modified'].includes(input.decision)) throw new Error('Invalid request decision')
    if (input.ids.length === 0) throw new Error('No requests to decide')

    const fetchedRows = await attendanceRepository.getFixedOffDayRequestsByIds(input.ids)
    const rowsById = new Map(fetchedRows.map(r => [r.id, r]))
    const rows = input.ids.map(id => rowsById.get(id) ?? null)
    const missing = rows.some(r => !r)
    if (missing) throw new Error('Weekly day off request not found')
    const autoApproved = rows.some(r => r!.source === 'auto_assigned' && r!.status === 'approved')
    if (autoApproved) {
      throw new Error('This day off was auto-assigned and is already approved — nothing to decide')
    }

    if (input.decision === 'modified') {
      const newDates = input.new_dates ?? []
      if (newDates.length !== input.ids.length) throw new Error('new_dates must match ids 1:1')
      if (new Set(newDates).size !== newDates.length) throw new Error('new_dates must not repeat a date')
    }

    // Owner picks each replacement date freely (any week) — a row whose "replacement" comes back
    // identical to what it already had is really just being approved as requested, not modified.
    // This lets one batch decision mix "approve the safe dates" with "swap only the flagged ones."
    const reviewedAt = new Date().toISOString()
    return Promise.all(input.ids.map((id, i) => {
      const row = rows[i]!
      const newDate = input.decision === 'modified' ? input.new_dates![i] : undefined
      const unchanged = newDate !== undefined && newDate === row.request_date
      return attendanceRepository.updateFixedOffDayRequest(id, {
        status: unchanged ? 'approved' : input.decision,
        reviewed_by: input.reviewer_id,
        reviewed_at: reviewedAt,
        ...(newDate !== undefined && !unchanged ? { request_date: newDate } : {}),
      })
    }))
  },

  // UC52 — Submit Shift Swap Request (M or E initiates)
  async submitShiftSwapRequest(input: ShiftSwapRequestCreateInput) {
    if (input.requester_id === input.counterpart_id) throw new Error('Cannot swap shifts with yourself')

    const [reqAss, ctrAss] = await Promise.all([
      attendanceRepository.getShiftAssignmentById(input.requester_assignment_id),
      attendanceRepository.getShiftAssignmentById(input.counterpart_assignment_id),
    ])
    if (!reqAss) throw new Error('Your shift assignment not found')
    if (!ctrAss) throw new Error('Counterpart shift assignment not found')
    if (reqAss.user_id !== input.requester_id) throw new Error('You are not assigned to this shift')
    if (ctrAss.user_id !== input.counterpart_id) throw new Error('Counterpart is not assigned to that shift')

    // Validate same department and same role
    const reqShift = reqAss.shifts
    const ctrShift = ctrAss.shifts
    if (!reqShift || !ctrShift) throw new Error('Shift data missing')
    if (reqShift.department_id !== ctrShift.department_id) throw new Error('Both shifts must be in the same department')

    const users = await attendanceRepository.getUsersByIds([input.requester_id, input.counterpart_id])
    const requester = users.find(u => u.id === input.requester_id)
    const counterpart = users.find(u => u.id === input.counterpart_id)
    if (!requester || !counterpart) throw new Error('User not found')
    if (requester.role !== counterpart.role) throw new Error('Both users must have the same role to swap shifts')

    // Neither shift may be today or earlier — earliest swappable shift is tomorrow
    assertShiftIsSwappable(reqShift, 'Your')
    assertShiftIsSwappable(ctrShift, 'The counterpart')

    // Check no other pending request exists for either assignment
    const [reqLocks, ctrLocks] = await Promise.all([
      attendanceRepository.getPendingSwapRequestsByAssignment(input.requester_assignment_id),
      attendanceRepository.getPendingSwapRequestsByAssignment(input.counterpart_assignment_id),
    ])
    if (reqLocks.length > 0) throw new Error('Your shift already has a pending swap request')
    if (ctrLocks.length > 0) throw new Error('The counterpart shift already has a pending swap request')

    // Limit/deadline rules are deliberately NOT checked here — they're evaluated when the
    // counterpart accepts (evaluateShiftSwapRules), since both can change while this waits.
    return attendanceRepository.createShiftSwapRequest(input)
  },

  // Counterpart responds to a swap request
  async respondShiftSwapRequest(input: ShiftSwapCounterpartDecisionInput) {
    if (!['approved', 'rejected'].includes(input.decision)) throw new Error('Invalid decision')
    let request = await attendanceRepository.getShiftSwapRequestById(input.id)
    if (!request) throw new Error('Shift swap request not found')
    if (request.counterpart_id !== input.counterpart_id) throw new Error('You are not the counterpart of this request')
    request = await autoExpireSwapRequestIfNeeded(request)
    if (request.status !== 'pending') throw new Error('Request is no longer pending')
    if (request.counterpart_status !== 'pending') throw new Error('Already responded')

    const fields: Parameters<typeof attendanceRepository.updateShiftSwapRequest>[1] = {
      counterpart_status: input.decision,
      counterpart_reviewed_at: new Date().toISOString(),
    }
    // If counterpart rejects, close the whole request
    if (input.decision === 'rejected') fields.status = 'rejected'

    const updated = await attendanceRepository.updateShiftSwapRequest(input.id, fields)
    if (input.decision !== 'approved') return updated

    // Both parties have now agreed — THIS is when the limit/deadline rules are evaluated
    // (not at submission), so the verdict reflects the state at agreement time.
    const [reqAss, ctrAss] = await Promise.all([
      attendanceRepository.getShiftAssignmentById(request.requester_assignment_id),
      attendanceRepository.getShiftAssignmentById(request.counterpart_assignment_id),
    ])
    const shifts = [reqAss?.shifts, ctrAss?.shifts].filter(Boolean) as Shift[]
    const settings = await shiftSwapSettingsRepository.getSettings(request.company_id)
    const verdict = await evaluateShiftSwapRules(settings, request, shifts)

    if (verdict.outcome === 'reject') {
      return attendanceRepository.updateShiftSwapRequest(input.id, {
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        owner_review_reason: verdict.reason,
      })
    }
    if (verdict.outcome === 'escalate') {
      return attendanceRepository.updateShiftSwapRequest(input.id, {
        requires_owner_review: true,
        owner_review_reason: verdict.reason,
      })
    }
    if (settings?.auto_approval_enabled) {
      return finalizeApprovedShiftSwap({ ...request, counterpart_status: 'approved' }, null)
    }
    return updated
  },

  // Requester withdraws before counterpart responds or before owner decides
  async withdrawShiftSwapRequest(input: ShiftSwapWithdrawInput) {
    const request = await attendanceRepository.getShiftSwapRequestById(input.id)
    if (!request) throw new Error('Shift swap request not found')
    if (request.requester_id !== input.requester_id) throw new Error('Only the requester can withdraw')
    if (request.status !== 'pending') throw new Error('Request is no longer pending')
    return attendanceRepository.updateShiftSwapRequest(input.id, { status: 'withdrawn' })
  },

  // UC55 — Submit Fixed Day Off Request (M or E). Always for the upcoming week (the week after
  // the current one), as a batch of specific dates, subject to the Owner-configured quota and
  // weekly submission deadline.
  async submitFixedOffDayRequest(input: {
    user_id: string
    company_id: string
    dates: string[]
  }) {
    if (input.dates.length === 0) throw new Error('Select at least one date')

    const todayKey = new Date().toISOString().slice(0, 10)
    for (const date of input.dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`)
      if (date <= todayKey) throw new Error(`${date} is not in the future`)
    }

    const weekStarts = new Set(input.dates.map(computeWeekStart))
    if (weekStarts.size > 1) throw new Error('All dates must fall within the same week')
    const targetWeekStart = [...weekStarts][0]

    // Whichever week is currently open shifts forward once a window's own deadline passes (that
    // window is closed/auto-assigned), so a Manager/Employee can only ever submit for the one week
    // that's genuinely still open — never several at once, and never one that's already locked in.
    const deadline = await offDaySettingsRepository.getDeadline(input.company_id)
    const activeWeekStart = resolveActiveSubmissionWeekStart(todayKey, deadline)
    if (targetWeekStart !== activeWeekStart) {
      throw new Error(`Requests must be for the currently open week (starting ${activeWeekStart})`)
    }

    const quotaOverride = await offDaySettingsRepository.getQuotaForUser(input.company_id, input.user_id)
    let quotaDefault = null
    if (!quotaOverride) {
      const requester = await authRepository.findByAuthIdOrInternalId(input.user_id)
      const requesterRole = requester?.role === 'Manager' ? 'Manager' : 'Employee'
      quotaDefault = await offDaySettingsRepository.getCompanyDefaultQuota(input.company_id, requesterRole)
    }
    const requiredDaysPerWeek = quotaOverride?.max_days_per_week ?? quotaDefault?.max_days_per_week ?? 2
    if (input.dates.length !== requiredDaysPerWeek) {
      throw new Error(`You must select exactly ${requiredDaysPerWeek} day(s) off per week`)
    }

    const existingForWeek = await attendanceRepository.getFixedOffDayRequestsByUserAndWeek(input.user_id, input.company_id, targetWeekStart)
    if (existingForWeek.some(r => r.source === 'auto_assigned')) {
      throw new Error('This week has already been auto-assigned — the submission window has closed')
    }
    const alreadyApproved = existingForWeek.filter(r => r.status === 'approved')
    const conflicting = input.dates.find(date => alreadyApproved.some(r => r.request_date === date && !input.dates.includes(date)))
    if (conflicting) throw new Error(`${conflicting} is already approved and cannot be changed`)
    // Replace any prior pending/rejected submission for this week with the new set.
    await attendanceRepository.deleteFixedOffDayRequestsByUserAndWeek(input.user_id, input.company_id, targetWeekStart, ['pending', 'rejected'])

    return attendanceRepository.createFixedOffDayRequests({
      user_id: input.user_id,
      company_id: input.company_id,
      dates: input.dates,
      week_start: targetWeekStart,
      source: 'submitted',
    })
  },

  async getUpcomingApprovedOffDates(user_id: string): Promise<string[]> {
    const requests = await attendanceRepository.getFixedOffDayRequestsByUser(user_id)
    const todayKey = new Date().toISOString().slice(0, 10)
    return requests
      .filter(r => r.status === 'approved' && r.request_date >= todayKey)
      .map(r => r.request_date)
      .sort()
  },

  // UC52/55 — View own submitted requests (M or E) — includes both sides of a swap
  async getMyRequests(user_id: string): Promise<{
    swaps: ShiftSwapRequestView[]
    time_off: TimeOffRequestView[]
    fixed_off: FixedOffDayRequestView[]
  }> {
    const [swaps, timeOffRequests, fixed_off] = await Promise.all([
      attendanceRepository.getShiftSwapRequestsByUser(user_id),
      attendanceRepository.getTimeOffRequestsByUser(user_id),
      attendanceRepository.getFixedOffDayRequestsByUser(user_id),
    ])

    // Build swapsView using the same logic as getShiftSwapRequests
    let swapsView: ShiftSwapRequestView[] = []
    if (swaps.length > 0) {
      const assignmentIds = [...new Set(swaps.flatMap(s => [s.requester_assignment_id, s.counterpart_assignment_id]))]
      const userIds = [...new Set(swaps.flatMap(s => [s.requester_id, s.counterpart_id]))]
      const [assignmentsArr, users] = await Promise.all([
        Promise.all(assignmentIds.map(id => attendanceRepository.getShiftAssignmentById(id))),
        attendanceRepository.getUsersByIds(userIds),
      ])
      const assignmentsById = new Map(assignmentsArr.filter(Boolean).map(a => [a!.id, a!]))
      const usersById = indexById(users)

      // Auto-reject any pending request whose shift date has arrived — see autoExpireSwapRequestIfNeeded.
      await Promise.all(swaps.map(async req => {
        if (req.status !== 'pending') return
        const expired =
          isShiftDateExpired(assignmentsById.get(req.requester_assignment_id)?.shifts?.shift_date) ||
          isShiftDateExpired(assignmentsById.get(req.counterpart_assignment_id)?.shifts?.shift_date)
        if (!expired) return
        await attendanceRepository.updateShiftSwapRequest(req.id, { status: 'rejected', reviewed_at: new Date().toISOString() })
        req.status = 'rejected'
      }))

      const [taskCounts, movableTasks] = await Promise.all([
        Promise.all(assignmentIds.map(id => attendanceRepository.getTasksByShiftAssignment(id).then(t => ({ id, count: t.length })))),
        Promise.all(assignmentIds.map(id => attendanceRepository.getMovableTasksByShiftAssignment(id).then(tasks => ({ id, tasks })))),
      ])
      const taskCountById = new Map(taskCounts.map(tc => [tc.id, tc.count]))
      const movableTasksById = new Map(movableTasks.map(mt => [mt.id, mt.tasks]))
      const deptIds = [...new Set(assignmentsArr.filter(Boolean).map(a => a!.shifts?.department_id).filter(Boolean) as string[])]
      const depts = await attendanceRepository.getDepartmentsByIds(deptIds)
      const deptsById = new Map(depts.map(d => [d.id, d.name]))

      swapsView = swaps.map(req => {
        const reqAss = assignmentsById.get(req.requester_assignment_id)
        const ctrAss = assignmentsById.get(req.counterpart_assignment_id)
        const requester = usersById.get(req.requester_id)
        const counterpart = usersById.get(req.counterpart_id)
        return {
          ...req,
          requester_name: requester?.full_name ?? 'Unknown',
          requester_role: requester?.role ?? '',
          requester_photo_url: requester?.profile_photo_url ?? null,
          counterpart_name: counterpart?.full_name ?? 'Unknown',
          counterpart_role: counterpart?.role ?? '',
          counterpart_photo_url: counterpart?.profile_photo_url ?? null,
          department_name: deptsById.get(reqAss?.shifts?.department_id ?? '') ?? null,
          requester_shift_title: reqAss?.shifts?.title ?? null,
          requester_shift_date: reqAss?.shifts?.shift_date ?? null,
          requester_start_time: reqAss?.shifts?.start_time ?? null,
          requester_end_time: reqAss?.shifts?.end_time ?? null,
          counterpart_shift_title: ctrAss?.shifts?.title ?? null,
          counterpart_shift_date: ctrAss?.shifts?.shift_date ?? null,
          counterpart_start_time: ctrAss?.shifts?.start_time ?? null,
          counterpart_end_time: ctrAss?.shifts?.end_time ?? null,
          requester_task_count: taskCountById.get(req.requester_assignment_id) ?? 0,
          counterpart_task_count: taskCountById.get(req.counterpart_assignment_id) ?? 0,
          requester_movable_tasks: movableTasksById.get(req.requester_assignment_id) ?? [],
          counterpart_movable_tasks: movableTasksById.get(req.counterpart_assignment_id) ?? [],
        }
      })
    }

    const foUsers = await attendanceRepository.getUsersByIds([user_id])
    const foUsersById = indexById(foUsers)
    const foDeptByUser = fixed_off.length > 0
      ? await resolveDepartmentIdsByUser([user_id], foUsersById, fixed_off[0].company_id)
      : new Map<string, string | null>()
    const fixedOffView: FixedOffDayRequestView[] = fixed_off.map(req => ({
      ...req,
      requester_name: foUsersById.get(req.user_id)?.full_name ?? 'Unknown',
      requester_role: foUsersById.get(req.user_id)?.role ?? '',
      department_id: foDeptByUser.get(req.user_id) ?? null,
    }))

    const timeOffView = await buildTimeOffRequestViews(timeOffRequests)

    return { swaps: swapsView, time_off: timeOffView, fixed_off: fixedOffView }
  },
}
