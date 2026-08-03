// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { authRepository } from '@/repositories/auth/authRepository'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { offDaySettingsRepository } from '@/repositories/owner/offDaySettingsRepository'
import { shiftSwapSettingsRepository } from '@/repositories/owner/shiftSwapSettingsRepository'
import { shiftSwapDepartmentSettingsRepository } from '@/repositories/owner/shiftSwapDepartmentSettingsRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { taskRepository } from '@/repositories/owner/taskRepository'
import { MIN_MANAGERS_PER_DAY, MIN_EMPLOYEES_PER_DAY, weekStart as computeWeekStart } from '@/lib/schedulingConstants'
import { sgtInstant, sgtShiftEndInstant, sgtTodayKey } from '@/lib/singaporeTime'
import { Shift } from '@/types/Shift'
import {
  AttendanceDashboard,
  AttendanceDashboardRecord,
  AttendanceExceptionType,
  AttendanceModifiedTimeField,
  AttendanceModifyTimesInput,
  FixedOffDayDecisionGroupInput,
  FixedOffDayDecisionInput,
  FixedOffDayRequest,
  FixedOffDayRequestView,
  ShiftSwapCounterpartDecisionInput,
  ShiftSwapOwnerDecisionInput,
  ShiftSwapRequest,
  ShiftSwapRequestCreateInput,
  ShiftSwapRequestView,
  ShiftSwapRuleConfig,
  ShiftSwapWithdrawInput,
} from '@/types/Attendance'

// shift_date/start_time/end_time are Singapore-nominal wall-clock values (see
// src/lib/singaporeTime) — sgtInstant resolves the real instant they represent, comparable to
// the already-UTC clock_in_time/clock_out_time timestamps.
function combineDateTime(date: string, time: string): Date {
  return sgtInstant(date, time)
}

// Same-day/past-day swaps are disallowed — earliest swappable shift is tomorrow. This compares
// plain calendar-day strings (both shift_date and "today" derived the same Singapore-nominal way)
// rather than combineDateTime, since the rule is about calendar days, not exact timestamps.
function isShiftDateExpired(shiftDate: string | null | undefined): boolean {
  if (!shiftDate) return false
  return shiftDate <= sgtTodayKey()
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
  record: {
    clock_in_time: string | null
    clock_out_time: string | null
    modified_clock_in_time?: string | null
    modified_clock_out_time?: string | null
  } | null
}): AttendanceExceptionType[] {
  const exceptions: AttendanceExceptionType[] = []
  // BUG-021: an overnight shift's end (end_time <= start_time) falls on the following Singapore
  // calendar day — sgtShiftEndInstant resolves that, instead of treating it as same-day.
  const shiftEnd = sgtShiftEndInstant(input.shift_date, input.start_time, input.end_time)
  const now = new Date()

  // An Owner/Partner/Manager correction (UC56) supersedes the worker's original clock times for
  // every exception check below — otherwise a corrected record keeps flagging Late/Absent forever.
  const clockInTime = input.record?.modified_clock_in_time ?? input.record?.clock_in_time ?? null
  const clockOutTime = input.record?.modified_clock_out_time ?? input.record?.clock_out_time ?? null

  // Absent: no clock-in by shift end, OR clocked in after shift end (invalid clock-in)
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

  // Present window: clock-in within 10 min after shift start (grace) = not late.
  // Late: clock-in more than 10 min after shift start.
  // The grace period is also applied at clock-in time (attendanceGrace.ts) so a clock-in
  // recorded at exactly start_time can be ≤10 min after and is never flagged late.
  if (minutesAfter(clockInTime, input.shift_date, input.start_time) > 10) exceptions.push('late')
  if (clockOutTime && Math.round((new Date(clockOutTime).getTime() - shiftEnd.getTime()) / 60000) > 15) exceptions.push('overtime')
  return exceptions
}

function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map(row => [row.id, row]))
}

// Truncates to minute precision ('YYYY-MM-DDTHH:MM') before comparing — the review modal only
// lets a user edit to the minute (AM/PM picker), but re-submitting an untouched field still
// round-trips through toISO() and drops the original's seconds/ms, which would otherwise make
// every field look "changed" on every save even when the user only touched one of them.
function fieldChangedToMinute(prev: string | null, next: string | null): boolean {
  const truncate = (iso: string | null) => iso?.slice(0, 16) ?? null
  return truncate(prev) !== truncate(next)
}

type ModifiableAttendanceTimes = {
  clock_in_time: string | null
  clock_out_time: string | null
  break_in_time: string | null
  break_out_time: string | null
  modified_clock_in_time: string | null
  modified_clock_out_time: string | null
  modified_break_in_time: string | null
  modified_break_out_time: string | null
}

// Which of the four time fields have actually been corrected — derived live by comparing each
// raw column (the true original; clock_in_time/clock_out_time/break_in_time/break_out_time are
// never overwritten) against its modified_* counterpart at minute precision, rather than reading
// a stored flag. modifyAttendanceTimes rewrites all four modified_* columns on every save
// regardless of which field the reviewer actually touched, so "the column has a value" alone
// doesn't mean "this field was modified" — only a value that differs from the raw one does.
function getModifiedFields(record: ModifiableAttendanceTimes): AttendanceModifiedTimeField[] {
  const pairs: [AttendanceModifiedTimeField, string | null, string | null][] = [
    ['clock_in_time', record.clock_in_time, record.modified_clock_in_time],
    ['clock_out_time', record.clock_out_time, record.modified_clock_out_time],
    ['break_in_time', record.break_in_time, record.modified_break_in_time],
    ['break_out_time', record.break_out_time, record.modified_break_out_time],
  ]
  return pairs
    .filter(([, raw, adjusted]) => adjusted !== null && fieldChangedToMinute(raw, adjusted))
    .map(([field]) => field)
}

// UC56: Owner/Partner-modified clock/break times must stay internally consistent — enforced here
// (not just by the modal disabling Save) since a direct PATCH could otherwise skip the UI check.
// UC56 (expanded 2026-07-23): Owner/Partner may modify any company record. A Manager may only
// modify records belonging to Employees/Casual Workers in their own department(s) — never a
// peer Manager's, and never outside their department scope.
// UC56 (rank confirmed 2026-07-23): Owner and Partner outrank Manager and are equal to each other
// for this purpose — once either of them modifies a record, a Manager can no longer modify it
// further even within their own department (existing.modified_by check below). The reverse isn't
// true: Owner/Partner may always modify a record a Manager already corrected.
async function assertCanModifyClockTimes(
  existing: ModifiableAttendanceTimes & { id: string; modified_by: string | null },
  actor_id: string,
): Promise<void> {
  const [actor] = await attendanceRepository.getUsersByIds([actor_id])
  if (!actor) throw new Error('Reviewer not found')
  if (actor.role === 'Owner' || actor.role === 'Partner') return
  if (actor.role !== 'Manager') throw new Error('Not authorized to modify attendance records')

  const context = await attendanceRepository.getAttendanceRecordContext(existing.id)
  if (!context) throw new Error('Attendance record not found')

  const recordWasModified = getModifiedFields(existing).length > 0
  const idsToFetch = [context.assignee_user_id]
  if (recordWasModified && existing.modified_by) idsToFetch.push(existing.modified_by)
  const users = await attendanceRepository.getUsersByIds([...new Set(idsToFetch)])

  const assignee = users.find(u => u.id === context.assignee_user_id)
  if (assignee?.role !== 'Employee' && assignee?.role !== 'Casual Worker') {
    throw new Error('A Manager may only modify an Employee or Casual Worker\'s attendance record')
  }
  if (!context.department_id || !context.company_id) {
    throw new Error('Not authorized to modify this attendance record')
  }
  const managedDepts = await ownerTeamRepository.findManagerDepartments(actor_id, context.company_id)
  if (!managedDepts.some(d => d.department_id === context.department_id)) {
    throw new Error('Not authorized to modify attendance records outside your department')
  }

  if (recordWasModified && existing.modified_by) {
    const reviewer = users.find(u => u.id === existing.modified_by)
    if (reviewer?.role === 'Owner' || reviewer?.role === 'Partner') {
      throw new Error('This record was last modified by Owner/Partner and can no longer be modified by a Manager')
    }
  }
}

function validateModifiedAttendanceTimes(times: {
  clock_in_time: string | null
  clock_out_time: string | null
  break_in_time: string | null
  break_out_time: string | null
}): void {
  const clockIn = times.clock_in_time ? new Date(times.clock_in_time).getTime() : null
  const clockOut = times.clock_out_time ? new Date(times.clock_out_time).getTime() : null
  const breakIn = times.break_in_time ? new Date(times.break_in_time).getTime() : null
  const breakOut = times.break_out_time ? new Date(times.break_out_time).getTime() : null

  if (clockIn !== null && clockOut !== null && clockIn > clockOut) {
    throw new Error('Clock In cannot be later than Clock Out')
  }
  if (breakIn !== null && breakOut !== null && breakIn > breakOut) {
    throw new Error('Break In cannot be later than Break Out')
  }
  if (breakIn !== null && clockIn !== null && clockOut !== null && (breakIn < clockIn || breakIn > clockOut)) {
    throw new Error('Break In must be between Clock In and Clock Out')
  }
  if (breakOut !== null && clockIn !== null && clockOut !== null && (breakOut < clockIn || breakOut > clockOut)) {
    throw new Error('Break Out must be between Clock In and Clock Out')
  }
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
  settings: ShiftSwapRuleConfig | null,
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

// Which settings row governs a given swap: Manager<->Manager swaps use the Owner/Partner's
// company-wide config; Employee<->Employee swaps use their department's Manager-owned config.
// (submitShiftSwapRequest already enforces both parties share a role and a department, so the
// requester's role + either shift's department_id fully determines the scope.)
async function resolveSwapRuleSettings(
  company_id: string,
  requesterRole: string,
  department_id: string | null,
): Promise<ShiftSwapRuleConfig | null> {
  if (requesterRole === 'Manager') return shiftSwapSettingsRepository.getSettings(company_id)
  if (!department_id) return null
  return shiftSwapDepartmentSettingsRepository.getSettings(company_id, department_id)
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

  // Owner/Partner must settle every submitted request first. Only after the submitted queue for
  // this week is fully approved/modified do non-submitters get auto-assigned from the remaining
  // staffing-safe dates.
  const hasPendingSubmittedRequests = existingForWeek.some(row => row.source === 'submitted' && row.status === 'pending')
  if (hasPendingSubmittedRequests) return

  const usersWithRows = new Set(existingForWeek.filter(row => row.status !== 'rejected').map(r => r.user_id))
  // Once everyone already has a row for the week (submitted or previously auto-assigned), there's
  // nothing left to assign — bail out before the expensive per-department-per-date headcount work
  // below, which this call would otherwise redo from scratch on every single page load for the rest
  // of the week (it was the dominant cost behind the Weekly Day Off tab feeling slow every time).
  const needsAssignment = managers.some(m => !usersWithRows.has(m.id)) || employees.some(e => !usersWithRows.has(e.id))
  if (!needsAssignment) return

  const candidateDates = Array.from({ length: 7 }, (_, i) => addDays(upcomingWeekStart, i))

  const managerDeptById = new Map<string, string | null>()
  await Promise.all(managers.map(async m => {
    const depts = await ownerTeamRepository.findManagerDepartments(m.id, company_id)
    managerDeptById.set(m.id, depts[0]?.department_id ?? null)
  }))

  const roleAndDeptById = new Map<string, { role: 'Manager' | 'Employee'; department_id: string | null }>()
  managers.forEach(m => roleAndDeptById.set(m.id, { role: 'Manager', department_id: managerDeptById.get(m.id) ?? null }))
  employees.forEach(e => roleAndDeptById.set(e.id, { role: 'Employee', department_id: e.department_id }))

  // Per-department roster totals (every Manager/Employee assigned there), NOT that week's
  // scheduled shift_assignments — off-days for an upcoming week are decided BEFORE that week's
  // shifts are built (shifts get built around who's already off), so shift headcount for a future
  // week is routinely still zero at this point, which would make every single day "unsafe" and
  // silently auto-assign nobody. The roster is the actual pool of people this rule is protecting.
  const rosterByDept = new Map<string, { managers: number; employees: number }>()
  const bumpRoster = (departmentId: string | null, role: 'Manager' | 'Employee') => {
    if (!departmentId) return
    const current = rosterByDept.get(departmentId) ?? { managers: 0, employees: 0 }
    if (role === 'Manager') current.managers += 1
    else current.employees += 1
    rosterByDept.set(departmentId, current)
  }
  managers.forEach(m => bumpRoster(managerDeptById.get(m.id) ?? null, 'Manager'))
  employees.forEach(e => bumpRoster(e.department_id, 'Employee'))

  // Consumed-per-department-date headcount across this sweep run, seeded from the roster above and
  // then reserved for both (a) people who already submitted their own off-days before the deadline
  // — these are locked in first — and (b) each user in this sweep as they're assigned an off-day,
  // so later users' safety checks see earlier reservations from the same run.
  const consumed = new Map<string, { managers: number; employees: number }>()
  const keyOf = (departmentId: string, date: string) => `${departmentId}_${date}`

  const ensureSeeded = (departmentId: string, date: string): { managers: number; employees: number } => {
    const key = keyOf(departmentId, date)
    if (!consumed.has(key)) {
      consumed.set(key, { ...(rosterByDept.get(departmentId) ?? { managers: 0, employees: 0 }) })
    }
    return consumed.get(key)!
  }

  const isSafeDate = (departmentId: string | null, role: 'Manager' | 'Employee', date: string): boolean => {
    if (!departmentId) return true
    const current = ensureSeeded(departmentId, date)
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

  // Lock in already-submitted off-days first — reserve their headcount impact before checking
  // what's still safe to auto-assign to non-submitters. Rejected rows don't hold a day off.
  for (const row of existingForWeek) {
    if (row.status === 'rejected') continue
    const info = roleAndDeptById.get(row.user_id)
    if (!info?.department_id) continue
    ensureSeeded(info.department_id, row.requested_date)
    markConsumed(info.department_id, info.role, row.requested_date)
  }

  const candidates: Array<{ id: string; role: 'Manager' | 'Employee'; department_id: string | null }> = [
    ...managers.filter(m => !usersWithRows.has(m.id)).map(m => ({ id: m.id, role: 'Manager' as const, department_id: managerDeptById.get(m.id) ?? null })),
    ...employees.filter(e => !usersWithRows.has(e.id)).map(e => ({ id: e.id, role: 'Employee' as const, department_id: e.department_id })),
  ].sort((a, b) => a.id.localeCompare(b.id))

  for (const candidate of candidates) {
    const quotaOverride = await offDaySettingsRepository.getQuotaForUser(company_id, candidate.id)
    const quotaDefault = quotaOverride ? null : await offDaySettingsRepository.getCompanyDefaultQuota(company_id, candidate.role)
    const maxDaysPerWeek = quotaOverride?.max_days_per_week ?? quotaDefault?.max_days_per_week ?? 2

    const safeDates = candidateDates.filter(date => isSafeDate(candidate.department_id, candidate.role, date))
    const shuffled = [...safeDates].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, maxDaysPerWeek)
    if (picked.length === 0) continue

    for (const date of picked) markConsumed(candidate.department_id, candidate.role, date)

    await attendanceRepository.createFixedOffDayRequests({
      user_id: candidate.id,
      company_id,
      dates: picked,
      requested_week: upcomingWeekStart,
      source: 'auto_assigned',
    })
  }
}

// Shared by getAttendanceDashboard (all-time, used by AI review/anomaly detection which need to
// scan every pending record regardless of date) and getAttendanceByDateRange (UC50/UC51, which
// need just today or just a calendar month) — same assembly, different assignment source.
async function buildDashboardRecords(
  company_id: string,
  assignments: Awaited<ReturnType<typeof attendanceRepository.getAssignmentsByCompany>>,
): Promise<AttendanceDashboardRecord[]> {
  const assignmentIds = assignments.map(assignment => assignment.id)
  const records = await attendanceRepository.getAttendanceRecordsByAssignmentIds(assignmentIds)

  const userIds = new Set<string>()
  const departmentIds = new Set<string>()
  const casualWorkerIds = new Set<string>()
  assignments.forEach(assignment => {
    if (assignment.user_id) userIds.add(assignment.user_id)
    if (assignment.supervisor_employee_id) userIds.add(assignment.supervisor_employee_id)
    if (assignment.shifts?.department_id) departmentIds.add(assignment.shifts.department_id)
  })
  records.forEach(record => {
    if (record.user_id) userIds.add(record.user_id)
    if (record.modified_by) userIds.add(record.modified_by)
  })

  const postingIds = new Set<string>()
  assignments.forEach(assignment => {
    if (assignment.shifts?.source_job_posting_id) postingIds.add(assignment.shifts.source_job_posting_id)
    if (assignment.user_id) casualWorkerIds.add(assignment.user_id)
  })

  const [users, departments, postings, banStatusByUser] = await Promise.all([
    attendanceRepository.getUsersByIds([...userIds]),
    attendanceRepository.getDepartmentsByIds([...departmentIds]),
    attendanceRepository.getJobPostingsByIds([...postingIds]),
    attendanceRepository.getCasualBanStatusByCompany(company_id, [...casualWorkerIds]),
  ])
  const usersById = indexById(users)
  const departmentsById = indexById(departments)
  const postingsById = indexById(postings)
  const recordsByAssignment = new Map(records.map(record => [record.shift_assignment_id, record]))

  return assignments
    .filter(assignment => assignment.shifts)
    .map(assignment => {
      const shift = assignment.shifts!
      const record = recordsByAssignment.get(assignment.id) ?? null
      return {
        assignment,
        shift,
        assignee_name: (assignment.user_id ? usersById.get(assignment.user_id)?.full_name : null) ?? assignment.user_name_snapshot ?? 'Removed member',
        assignee_role: (assignment.user_id ? usersById.get(assignment.user_id)?.role : null) ?? 'Member',
        assignee_profile_photo_url: (assignment.user_id ? usersById.get(assignment.user_id)?.profile_photo_url : null) ?? null,
        assignee_worker_status: (assignment.user_id && banStatusByUser.get(assignment.user_id)?.inactive_at) ? 'inactive' : 'active',
        assignee_hourly_rate: shift.hourly_rate ?? null,
        supervisor_name: assignment.supervisor_employee_id ? usersById.get(assignment.supervisor_employee_id)?.full_name ?? null : null,
        department_name: shift.department_id ? departmentsById.get(shift.department_id)?.name ?? null : null,
        job_title: shift.source_job_posting_id ? postingsById.get(shift.source_job_posting_id)?.title ?? null : null,
        record,
        modifier_name: record?.modified_by ? usersById.get(record.modified_by)?.full_name ?? null : null,
        modifier_role: record?.modified_by ? usersById.get(record.modified_by)?.role ?? null : null,
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
    const dashboardRecords = await buildDashboardRecords(company_id, assignments)

    return {
      records: dashboardRecords,
      summary: {
        total_assignments: dashboardRecords.length,
        late: dashboardRecords.filter(row => row.exceptions.includes('late')).length,
        absent: dashboardRecords.filter(row => row.exceptions.includes('absent')).length,
        overtime: dashboardRecords.filter(row => row.exceptions.includes('overtime')).length,
      },
    }
  },

  // UC50/UC51 — Today's ratio + timeline, and the Past Attendance Record calendar, both need
  // records scoped to an explicit date window instead of the company's entire history.
  // BUG-023 (root cause A) — this path had no viewer/role concept at all, unlike
  // shiftService.getTimelineShifts' filterShiftsForViewer, so Manager/Employee's merged Shift
  // Calendar (which reads attendance via this range query, not the Timeline path) leaked Draft
  // shifts that hadn't been published yet.
  async getAttendanceByDateRange(company_id: string, from_date: string, to_date: string, viewer?: { role?: string }): Promise<AttendanceDashboardRecord[]> {
    const assignments = await attendanceRepository.getAssignmentsByCompanyAndDateRange(company_id, from_date, to_date)
    const records = await buildDashboardRecords(company_id, assignments)
    if (viewer?.role === 'Owner' || viewer?.role === 'Partner' || !viewer?.role) return records
    return records.filter(r => r.shift.publication_status === 'published')
  },

  // UC56 — the only action a reviewer can take on an attendance record: correct its clock/break
  // times. Whether anything actually changed (and which fields) is derived afterwards by
  // comparing the new modified_* values to their raw counterparts, not tracked as a decision.
  async modifyAttendanceTimes(input: AttendanceModifyTimesInput) {
    const existing = await attendanceRepository.getAttendanceRecordById(input.id)
    if (!existing) throw new Error('Attendance record not found')

    // UC56 (expanded 2026-07-23): Owner/Partner may modify any record; a Manager may only modify
    // their own department's Employee/Casual Worker records, never a peer Manager's, and never a
    // record Owner/Partner already modified (they outrank Manager for this).
    await assertCanModifyClockTimes(existing, input.actor_id)

    const nextClockIn = input.clock_in_time ?? existing.clock_in_time
    const nextClockOut = input.clock_out_time ?? existing.clock_out_time
    const nextBreakIn = input.break_in_time ?? existing.break_in_time
    const nextBreakOut = input.break_out_time ?? existing.break_out_time
    validateModifiedAttendanceTimes({
      clock_in_time: nextClockIn,
      clock_out_time: nextClockOut,
      break_in_time: nextBreakIn,
      break_out_time: nextBreakOut,
    })

    // Compared against the true originals (the raw columns), not the previous modified_* values —
    // a submission that nets out identical to the true original (e.g. edited to 9:10 then edited
    // back to 9:00) correctly reports no changed fields, so it stops showing the "M" badge / reason
    // from before without any special-case "downgrade" branch.
    const changedFields = getModifiedFields({
      clock_in_time: existing.clock_in_time,
      clock_out_time: existing.clock_out_time,
      break_in_time: existing.break_in_time,
      break_out_time: existing.break_out_time,
      modified_clock_in_time: nextClockIn,
      modified_clock_out_time: nextClockOut,
      modified_break_in_time: nextBreakIn,
      modified_break_out_time: nextBreakOut,
    })
    // Enforced here too (not just the modal disabling Save) since a direct PATCH could otherwise
    // skip the UI check — a reason is mandatory whenever a time actually ends up different from
    // its true original.
    if (changedFields.length > 0 && !input.reason?.trim()) {
      throw new Error('A reason is required when modifying attendance times')
    }

    return attendanceRepository.updateAttendanceRecord(input.id, {
      modified_clock_in_time: nextClockIn,
      modified_clock_out_time: nextClockOut,
      modified_break_in_time: nextBreakIn,
      modified_break_out_time: nextBreakOut,
      modified_reason: changedFields.length > 0 ? input.reason?.trim() ?? null : null,
      modified_by: input.actor_id,
      modified_at: new Date().toISOString(),
    })
  },

  // options.managerId absent → Owner/Partner queue (Manager<->Manager swaps only).
  // options.managerId set → that Manager's queue (Employee<->Employee swaps within their
  // managed departments only). submitShiftSwapRequest enforces both parties share a role, so
  // the requester's role alone tells us which queue a given swap belongs to.
  async getShiftSwapRequests(company_id: string, options?: { managerId?: string }): Promise<ShiftSwapRequestView[]> {
    const allRequests = await attendanceRepository.getShiftSwapRequestsByCompany(company_id)
    const activeRequests = allRequests.filter(req => req.status !== 'withdrawn')
    if (activeRequests.length === 0) return []

    const assignmentIds = [...new Set(activeRequests.flatMap(r => [r.requester_assignment_id, r.counterpart_assignment_id]))]
    const userIds = [...new Set(activeRequests.flatMap(r => [r.requester_id, r.counterpart_id, r.reviewed_by]).filter(Boolean) as string[])]

    const [assignmentsArr, users] = await Promise.all([
      attendanceRepository.getShiftAssignmentsByIds(assignmentIds),
      attendanceRepository.getUsersByIds(userIds),
    ])
    const assignmentsById = new Map(assignmentsArr.map(a => [a.id, a]))
    const usersById = indexById(users)

    // Auto-reject any pending request whose shift date has arrived — see autoExpireSwapRequestIfNeeded.
    // Assignments are already loaded above, so this reuses them instead of refetching per-request.
    await Promise.all(activeRequests.map(async req => {
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
    let requests = activeRequests.filter(req => !(req.status === 'pending' && req.counterpart_status === 'pending'))
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
    // the accept-time verdict, because the settings may have changed after these requests arrived.
    // Also computes each party's remaining monthly quota so the reviewer can see e.g. "David 2/3
    // left, Rachel 0/3 left" while deciding. This queue is always homogeneous in requester role
    // (Manager queue = Manager-Manager swaps only, Employee queue = Employee-Employee swaps only —
    // see the role filter above), but an Employee queue can still span several of the Manager's
    // departments, each with its own settings row, so that branch resolves settings per department.
    let companySettings: ShiftSwapRuleConfig | null = null
    let deptSettingsById = new Map<string, ShiftSwapRuleConfig | null>()
    if (options?.managerId) {
      const reqDeptIds = [...new Set(requests.map(r => assignmentsById.get(r.requester_assignment_id)?.shifts?.department_id).filter(Boolean) as string[])]
      const deptSettings = await shiftSwapDepartmentSettingsRepository.getSettingsForDepartments(company_id, reqDeptIds)
      deptSettingsById = new Map(deptSettings.map(s => [s.department_id, s]))
    } else {
      companySettings = await shiftSwapSettingsRepository.getSettings(company_id)
    }
    const settingsForRequest = (req: ShiftSwapRequest): ShiftSwapRuleConfig | null => {
      if (!options?.managerId) return companySettings
      const deptId = assignmentsById.get(req.requester_assignment_id)?.shifts?.department_id
      return deptId ? deptSettingsById.get(deptId) ?? null : null
    }

    const swapsLeftByUser = new Map<string, number>()
    {
      const { start, end } = currentCalendarMonthRange()
      const pendingWithLimit = requests.filter(r => r.status === 'pending' && settingsForRequest(r)?.monthly_swap_limit != null)
      const pendingUserIds = [...new Set(pendingWithLimit.flatMap(r => [r.requester_id, r.counterpart_id]))]
      await Promise.all(pendingUserIds.map(async userId => {
        const req = pendingWithLimit.find(r => r.requester_id === userId || r.counterpart_id === userId)!
        const limit = settingsForRequest(req)!.monthly_swap_limit!
        const used = await attendanceRepository.countApprovedShiftSwapsForUser(company_id, userId, start, end)
        swapsLeftByUser.set(userId, Math.max(0, limit - used))
      }))
    }

    return requests.map(req => {
      const reqAss = assignmentsById.get(req.requester_assignment_id)
      const ctrAss = assignmentsById.get(req.counterpart_assignment_id)
      const requester = usersById.get(req.requester_id)
      const counterpart = usersById.get(req.counterpart_id)
      const deptName = deptsById.get(reqAss?.shifts?.department_id ?? '') ?? null
      const isPending = req.status === 'pending'
      const settings = settingsForRequest(req)
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
        reviewer_name: req.reviewed_by ? usersById.get(req.reviewed_by)?.full_name ?? 'Unknown' : null,
        department_name: deptName,
        requester_shift_title: null,
        requester_shift_date: reqAss?.shifts?.shift_date ?? null,
        requester_start_time: reqAss?.shifts?.start_time ?? null,
        requester_end_time: reqAss?.shifts?.end_time ?? null,
        counterpart_shift_title: null,
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
      owner_review_reason: input.reason ?? null,
    })
  },

  // UC56: Approve Fixed Day Off — Manager AND Employee submissions both route to the Owner/Partner
  // queue directly (Employees are no longer reviewed by their Manager first).
  async getFixedOffDayRequests(company_id: string): Promise<FixedOffDayRequestView[]> {
    await runAutoAssignmentSweepForUpcomingWeek(company_id)

    const allRequests = await attendanceRepository.getOffDayRequestsByCompany(company_id)
    if (allRequests.length === 0) return []

    const users = await attendanceRepository.getUsersByIds([...new Set(allRequests.flatMap(request => [request.user_id, request.reviewed_by]).filter(Boolean) as string[])])
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
      reviewer_name: request.reviewed_by ? usersById.get(request.reviewed_by)?.full_name ?? 'Unknown' : null,
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
    const unchanged = input.decision === 'modified' && input.new_date === existing.requested_date

    const updated = await attendanceRepository.updateFixedOffDayRequest(input.id, {
      status: unchanged ? 'approved' : input.decision,
      reviewed_by: input.reviewer_id,
      reviewed_at: new Date().toISOString(),
      ...(input.decision === 'modified' && !unchanged ? { requested_date: input.new_date } : {}),
    })
    await runAutoAssignmentSweepForUpcomingWeek(existing.company_id)
    return updated
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
    // Applied atomically (one DB transaction) — a batch can shuffle dates among rows the same
    // user already holds, which would transiently violate the unique constraint if each row were
    // updated by its own separate call. See decideFixedOffDayRequestGroupAtomic.
    const reviewedAt = new Date().toISOString()
    const statuses: string[] = []
    const requestDates: (string | null)[] = []
    input.ids.forEach((_, i) => {
      const row = rows[i]!
      const newDate = input.decision === 'modified' ? input.new_dates![i] : undefined
      const unchanged = newDate !== undefined && newDate === row.requested_date
      statuses.push(unchanged ? 'approved' : input.decision)
      requestDates.push(newDate !== undefined && !unchanged ? newDate : null)
    })

    const decided = await attendanceRepository.decideFixedOffDayRequestGroupAtomic({
      ids: input.ids,
      statuses,
      requested_dates: requestDates,
      reviewer_id: input.reviewer_id,
      reviewed_at: reviewedAt,
    })
    await runAutoAssignmentSweepForUpcomingWeek(rows[0]!.company_id)
    return decided
  },

  // UC52 — Submit Shift Swap Request (M or E initiates)
  async getShiftSwapConflict(company_id: string, assignment_id: string): Promise<{ has_pending: boolean }> {
    const assignment = await attendanceRepository.getShiftAssignmentById(assignment_id)
    if (!assignment?.shifts || assignment.shifts.company_id !== company_id) {
      throw new Error('Shift assignment not found')
    }

    const pending = await attendanceRepository.getPendingSwapRequestsByAssignment(assignment_id)
    return { has_pending: pending.length > 0 }
  },

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
    const requester = (await attendanceRepository.getUsersByIds([request.requester_id]))[0]
    const departmentId = reqAss?.shifts?.department_id ?? ctrAss?.shifts?.department_id ?? null
    const settings = await resolveSwapRuleSettings(request.company_id, requester?.role ?? '', departmentId)
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
        owner_review_reason: verdict.reason,
      })
    }
    if (settings?.auto_approval_enabled) {
      return finalizeApprovedShiftSwap({ ...request, counterpart_status: 'approved' }, null)
    }
    return updated
  },

  // Requester can remove their own swap record until it is finally approved.
  async withdrawShiftSwapRequest(input: ShiftSwapWithdrawInput) {
    const request = await attendanceRepository.getShiftSwapRequestById(input.id)
    if (!request) throw new Error('Shift swap request not found')
    if (request.requester_id !== input.requester_id) throw new Error('Only the requester can withdraw')
    if (request.status === 'approved') throw new Error('Approved shift swaps cannot be deleted')
    if (request.status === 'withdrawn') return request
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
    const requester = await authRepository.findByAuthIdOrInternalId(input.user_id)
    if (!requester || requester.company_id !== input.company_id) throw new Error('Requester not found')
    const requesterId = requester.id

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

    const existingForWeek = await attendanceRepository.getFixedOffDayRequestsByUserAndWeek(requesterId, input.company_id, targetWeekStart)
    if (existingForWeek.some(r => r.source === 'auto_assigned')) {
      throw new Error('This week has already been auto-assigned — the submission window has closed')
    }
    if (existingForWeek.some(r => r.status === 'pending')) {
      throw new Error('You already submitted an Off Day request for the currently open week')
    }
    if (existingForWeek.some(r => r.status === 'approved' || r.status === 'modified')) {
      throw new Error('This week has already been reviewed and cannot be submitted again')
    }

    // BUG-044 — requesting a day off on a date the requester is already rostered for used to
    // sail through with no warning, silently producing a conflict Owner/Partner would only spot
    // by noticing it themselves when reviewing the queue.
    const conflictingDates = await attendanceRepository.getShiftDatesForUserWithinDates(requesterId, input.dates)
    if (conflictingDates.length > 0) {
      throw new Error(`You already have a shift scheduled on ${conflictingDates.sort().join(', ')} — that date can't be requested off`)
    }
    // Legacy rejected rows should not block the current no-reject workflow.
    await attendanceRepository.deleteFixedOffDayRequestsByUserAndWeek(requesterId, input.company_id, targetWeekStart, ['rejected'])

    return attendanceRepository.createFixedOffDayRequests({
      user_id: requesterId,
      company_id: input.company_id,
      dates: input.dates,
      requested_week: targetWeekStart,
      source: 'submitted',
    })
  },

  async editFixedOffDayRequest(input: {
    user_id: string
    company_id: string
    requested_week: string
    dates: string[]
  }) {
    if (input.dates.length === 0) throw new Error('Select at least one date')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.requested_week)) throw new Error('Invalid requested_week')
    const requester = await authRepository.findByAuthIdOrInternalId(input.user_id)
    if (!requester || requester.company_id !== input.company_id) throw new Error('Requester not found')
    const requesterId = requester.id

    const todayKey = new Date().toISOString().slice(0, 10)
    for (const date of input.dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`)
      if (date <= todayKey) throw new Error(`${date} is not in the future`)
    }

    const weekStarts = new Set(input.dates.map(computeWeekStart))
    if (weekStarts.size > 1) throw new Error('All dates must fall within the same week')
    const targetWeekStart = [...weekStarts][0]
    if (targetWeekStart !== input.requested_week) throw new Error('Dates must stay within the original request week')

    const deadline = await offDaySettingsRepository.getDeadline(input.company_id)
    const activeWeekStart = resolveActiveSubmissionWeekStart(todayKey, deadline)
    if (input.requested_week !== activeWeekStart) {
      throw new Error('This Off Day request can no longer be edited')
    }

    const existingForWeek = await attendanceRepository.getFixedOffDayRequestsByUserAndWeek(requesterId, input.company_id, input.requested_week)
    const editableRows = existingForWeek.filter(r => r.source === 'submitted')
    if (editableRows.length === 0) throw new Error('Off Day request not found')
    if (editableRows.some(r => r.status !== 'pending')) {
      throw new Error('This Off Day request has already been reviewed and cannot be edited')
    }
    if (existingForWeek.some(r => r.source === 'auto_assigned')) {
      throw new Error('Auto-assigned Off Day records cannot be edited')
    }

    const quotaOverride = await offDaySettingsRepository.getQuotaForUser(input.company_id, requesterId)
    let quotaDefault = null
    if (!quotaOverride) {
      const requesterRole = requester.role === 'Manager' ? 'Manager' : 'Employee'
      quotaDefault = await offDaySettingsRepository.getCompanyDefaultQuota(input.company_id, requesterRole)
    }
    const requiredDaysPerWeek = quotaOverride?.max_days_per_week ?? quotaDefault?.max_days_per_week ?? 2
    if (input.dates.length !== requiredDaysPerWeek) {
      throw new Error(`You must select exactly ${requiredDaysPerWeek} day(s) off per week`)
    }

    await attendanceRepository.deleteFixedOffDayRequestsByUserAndWeek(requesterId, input.company_id, input.requested_week, ['pending'])
    return attendanceRepository.createFixedOffDayRequests({
      user_id: requesterId,
      company_id: input.company_id,
      dates: input.dates,
      requested_week: input.requested_week,
      source: 'submitted',
    })
  },

  async getUpcomingApprovedOffDates(user_id: string): Promise<string[]> {
    const requests = await attendanceRepository.getFixedOffDayRequestsByUser(user_id)
    const todayKey = new Date().toISOString().slice(0, 10)
    return requests
      .filter(r => r.status === 'approved' && r.requested_date >= todayKey)
      .map(r => r.requested_date)
      .sort()
  },

  // UC52/55 — View own submitted requests (M or E) — includes both sides of a swap
  async getMyRequests(user_id: string): Promise<{
    swaps: ShiftSwapRequestView[]
    fixed_off: FixedOffDayRequestView[]
  }> {
    const [swaps, fixed_off] = await Promise.all([
      attendanceRepository.getShiftSwapRequestsByUser(user_id),
      attendanceRepository.getFixedOffDayRequestsByUser(user_id),
    ])

    // Build swapsView using the same logic as getShiftSwapRequests
    let swapsView: ShiftSwapRequestView[] = []
    const visibleSwaps = swaps.filter(req => req.status !== 'withdrawn')
    if (visibleSwaps.length > 0) {
      const assignmentIds = [...new Set(visibleSwaps.flatMap(s => [s.requester_assignment_id, s.counterpart_assignment_id]))]
      const userIds = [...new Set(visibleSwaps.flatMap(s => [s.requester_id, s.counterpart_id, s.reviewed_by]).filter(Boolean) as string[])]
      // Batched — one query across all assignment ids instead of one round-trip per assignment.
      // getShiftSwapRequests (the reviewer queue) already got this fix; this requester-facing
      // sibling had drifted from it, which was making "My Requests" take 1-2s+ per load — each
      // assignment/task-count/movable-task lookup was its own separate Supabase round trip
      // (confirmed 2026-07-31).
      const [assignmentsArr, users] = await Promise.all([
        attendanceRepository.getShiftAssignmentsByIds(assignmentIds),
        attendanceRepository.getUsersByIds(userIds),
      ])
      const assignmentsById = new Map(assignmentsArr.map(a => [a.id, a]))
      const usersById = indexById(users)

      // Auto-reject any pending request whose shift date has arrived — see autoExpireSwapRequestIfNeeded.
      await Promise.all(visibleSwaps.map(async req => {
        if (req.status !== 'pending') return
        const expired =
          isShiftDateExpired(assignmentsById.get(req.requester_assignment_id)?.shifts?.shift_date) ||
          isShiftDateExpired(assignmentsById.get(req.counterpart_assignment_id)?.shifts?.shift_date)
        if (!expired) return
        await attendanceRepository.updateShiftSwapRequest(req.id, { status: 'rejected', reviewed_at: new Date().toISOString() })
        req.status = 'rejected'
      }))

      const shiftIds = [...new Set(assignmentIds.map(id => assignmentsById.get(id)?.shift_id).filter(Boolean) as string[])]
      const [shiftTasks, shiftMovableTasks] = await Promise.all([
        attendanceRepository.getTasksByShiftIds(shiftIds),
        attendanceRepository.getMovableTasksByShiftIds(shiftIds),
      ])
      const taskCountById = new Map(assignmentIds.map(id => {
        const shiftId = assignmentsById.get(id)?.shift_id
        return [id, shiftTasks.filter(t => t.shift_id === shiftId).length]
      }))
      const movableTasksById = new Map(assignmentIds.map(id => {
        const assignment = assignmentsById.get(id)
        const tasks = shiftMovableTasks
          .filter(t => t.shift_id === assignment?.shift_id && t.assigned_user_id === assignment?.user_id)
          .map(({ id, title, description, status, priority, due_at, created_at }) => ({ id, title, description, status, priority, due_at, created_at }))
        return [id, tasks]
      }))
      const deptIds = [...new Set(assignmentsArr.map(a => a.shifts?.department_id).filter(Boolean) as string[])]
      const depts = await attendanceRepository.getDepartmentsByIds(deptIds)
      const deptsById = new Map(depts.map(d => [d.id, d.name]))

      // Memoized within this call: "My Requests" is usually the same requester (and often the
      // same department) across several pending swaps, so without this the loop below was
      // re-fetching the identical settings row and the identical monthly-usage count once per
      // request instead of once per distinct (role, department) / (company, user) pair.
      const settingsCache = new Map<string, Promise<ShiftSwapRuleConfig | null>>()
      const cachedSwapRuleSettings = (cid: string, role: string, deptId: string | null) => {
        const key = `${cid}:${role}:${deptId ?? ''}`
        let cached = settingsCache.get(key)
        if (!cached) { cached = resolveSwapRuleSettings(cid, role, deptId); settingsCache.set(key, cached) }
        return cached
      }
      const usageCache = new Map<string, Promise<number>>()
      const cachedApprovedSwapCount = (cid: string, userId: string, start: string, end: string) => {
        const key = `${cid}:${userId}:${start}:${end}`
        let cached = usageCache.get(key)
        if (!cached) { cached = attendanceRepository.countApprovedShiftSwapsForUser(cid, userId, start, end); usageCache.set(key, cached) }
        return cached
      }

      swapsView = await Promise.all(visibleSwaps.map(async req => {
        const reqAss = assignmentsById.get(req.requester_assignment_id)
        const ctrAss = assignmentsById.get(req.counterpart_assignment_id)
        const requester = usersById.get(req.requester_id)
        const counterpart = usersById.get(req.counterpart_id)

        // Same live rule check the reviewer's queue shows (getShiftSwapRequests) — surfaced here
        // too so the requester can see whether they're over their monthly quota or past the
        // submission deadline for this shift. Shown regardless of status (not just while
        // pending) so every card in My Requests carries the same badges consistently — an
        // already-decided request still tells the requester what the rule check looked like.
        let monthly_swap_limit: number | null = null
        let requester_swaps_left: number | null = null
        let limit_exceeded: boolean | null = null
        let deadline_exceeded: boolean | null = null
        {
          const departmentId = reqAss?.shifts?.department_id ?? ctrAss?.shifts?.department_id ?? null
          const settings = await cachedSwapRuleSettings(req.company_id, requester?.role ?? '', departmentId)
          if (settings?.monthly_swap_limit != null) {
            monthly_swap_limit = settings.monthly_swap_limit
            const { start, end } = currentCalendarMonthRange()
            const used = await cachedApprovedSwapCount(req.company_id, req.requester_id, start, end)
            requester_swaps_left = Math.max(0, settings.monthly_swap_limit - used)
            limit_exceeded = requester_swaps_left <= 0
          }
          const ruleShifts = [reqAss?.shifts, ctrAss?.shifts].filter(Boolean) as Shift[]
          if (settings?.deadline_hours_before_shift != null && ruleShifts.length > 0) {
            deadline_exceeded = isPastSwapDeadline(settings.deadline_hours_before_shift, ruleShifts)
          }
        }

        return {
          ...req,
          requester_name: requester?.full_name ?? 'Unknown',
          requester_role: requester?.role ?? '',
          requester_photo_url: requester?.profile_photo_url ?? null,
          counterpart_name: counterpart?.full_name ?? 'Unknown',
          counterpart_role: counterpart?.role ?? '',
          counterpart_photo_url: counterpart?.profile_photo_url ?? null,
          reviewer_name: req.reviewed_by ? usersById.get(req.reviewed_by)?.full_name ?? 'Unknown' : null,
          department_name: deptsById.get(reqAss?.shifts?.department_id ?? '') ?? null,
          requester_shift_title: null,
          requester_shift_date: reqAss?.shifts?.shift_date ?? null,
          requester_start_time: reqAss?.shifts?.start_time ?? null,
          requester_end_time: reqAss?.shifts?.end_time ?? null,
          counterpart_shift_title: null,
          counterpart_shift_date: ctrAss?.shifts?.shift_date ?? null,
          counterpart_start_time: ctrAss?.shifts?.start_time ?? null,
          counterpart_end_time: ctrAss?.shifts?.end_time ?? null,
          requester_task_count: taskCountById.get(req.requester_assignment_id) ?? 0,
          counterpart_task_count: taskCountById.get(req.counterpart_assignment_id) ?? 0,
          requester_movable_tasks: movableTasksById.get(req.requester_assignment_id) ?? [],
          counterpart_movable_tasks: movableTasksById.get(req.counterpart_assignment_id) ?? [],
          monthly_swap_limit,
          requester_swaps_left,
          counterpart_swaps_left: null,
          limit_exceeded,
          deadline_exceeded,
        }
      }))
    }

    const foUserIds = [...new Set([user_id, ...fixed_off.map(req => req.reviewed_by).filter(Boolean) as string[]])]
    const foUsers = await attendanceRepository.getUsersByIds(foUserIds)
    const foUsersById = indexById(foUsers)
    const foDeptByUser = fixed_off.length > 0
      ? await resolveDepartmentIdsByUser([user_id], foUsersById, fixed_off[0].company_id)
      : new Map<string, string | null>()
    const fixedOffView: FixedOffDayRequestView[] = fixed_off.map(req => ({
      ...req,
      requester_name: foUsersById.get(req.user_id)?.full_name ?? 'Unknown',
      requester_role: foUsersById.get(req.user_id)?.role ?? '',
      reviewer_name: req.reviewed_by ? foUsersById.get(req.reviewed_by)?.full_name ?? 'Unknown' : null,
      department_id: foDeptByUser.get(req.user_id) ?? null,
    }))

    return { swaps: swapsView, fixed_off: fixedOffView }
  },
}
