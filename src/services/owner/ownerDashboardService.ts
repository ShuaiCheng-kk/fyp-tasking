// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { attendanceService, resolveActiveSubmissionWeekStart, resolveDeadlineDateForWeek } from '@/services/owner/attendanceService'
import { ownerTeamService } from '@/services/owner/ownerTeamService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { offDaySettingsService } from '@/services/owner/offDaySettingsService'
import { taskService } from '@/services/owner/taskService'
import { recruitmentService } from '@/services/owner/recruitmentService'
import { Task } from '@/types/Task'
import {
  AttendanceDepartmentGroup,
  AttendanceOverview,
  AttendancePersonRow,
  AttendanceRoleGroup,
  OwnerDashboardSummary,
  RecruitmentOverview,
  TaskOverviewGroup,
  TaskOverviewRow,
  WaitingOnYouItem,
} from '@/types/OwnerDashboard'

const STARTING_SOON_DAYS = 2

// Manager viewers get the same summary scoped to their own departments (UC role scope);
// null means the viewer is an Owner/Partner and sees the whole company.
type DeptScope = { ids: Set<string>; names: Set<string> } | null

// Local wall-clock calendar date — same convention as reportService.formatDateKey / taskService's
// own copy. due_at/shift_date "belong" to whichever local day they fall on, never a UTC slice.
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysToKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  return formatDateKey(date)
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00`)
  const to = new Date(`${toKey}T00:00:00`)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function combineDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}Z`)
}

function formatWeekLabel(weekStartKey: string): string {
  const start = new Date(`${weekStartKey}T00:00:00`)
  const end = new Date(`${addDaysToKey(weekStartKey, 6)}T00:00:00`)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)}–${fmt(end)}`
}

async function buildWaitingOnYou(company_id: string, owner_id: string, scope: DeptScope): Promise<WaitingOnYouItem[]> {
  const [swaps, deadline, kanban, postings, pendingApprovalPostings] = await Promise.all([
    attendanceService.getShiftSwapRequests(company_id),
    offDaySettingsService.getDeadline(company_id, owner_id).catch(() => null),
    taskService.getKanbanTasks(company_id, owner_id),
    recruitmentService.getJobPostings(company_id),
    recruitmentService.getPendingApprovalPostings(company_id),
  ])

  // 1. Review Shift Swap Requests — getShiftSwapRequests already scopes to the Owner's queue
  // (hides awaiting-counterpart and Employee-requester rows), so every pending row it returns
  // is waiting on the Owner. requires_owner_review only marks rule-violation escalations under
  // auto-approval mode — filtering on it would miss every manual-approval-mode request.
  const scopedSwaps = scope ? swaps.filter(s => s.department_name != null && scope.names.has(s.department_name)) : swaps
  const pendingSwaps = scopedSwaps.filter(s => s.status === 'pending')
  const swapOldest = pendingSwaps.length > 0
    ? pendingSwaps.reduce((oldest, s) => s.created_at < oldest ? s.created_at : oldest, pendingSwaps[0].created_at)
    : null

  // 2. Plan Next Week's Shifts — fires once the most recently closed submission week still has
  // pending Fixed Off Day requests waiting on the Owner.
  let offDayCount = 0
  let offDayDetail: string | null = null
  let offDayOldest: string | null = null
  if (deadline) {
    const todayKey = formatDateKey(new Date())
    const activeWeekStart = resolveActiveSubmissionWeekStart(todayKey, deadline)
    const closedWeekStart = addDaysToKey(activeWeekStart, -7)
    const closedRequests = await attendanceRepository.getOffDayRequestsByCompanyAndWeek(company_id, closedWeekStart)
    const pendingClosed = closedRequests.filter(r => r.status === 'pending')
    if (pendingClosed.length > 0) {
      offDayCount = pendingClosed.length
      offDayDetail = `for ${formatWeekLabel(closedWeekStart)}`
      const deadlineMoment = new Date(`${resolveDeadlineDateForWeek(closedWeekStart, deadline.deadline_weekday)}T${deadline.deadline_time}:00`)
      offDayOldest = deadlineMoment.toISOString()
    }
  }

  // 3. Review Tasks — tasks in Review, assigned by this Owner (getKanbanTasks already scopes by assigned_by)
  const reviewTasks = kanban.Review
  const reviewOldest = reviewTasks.length > 0
    ? reviewTasks.reduce((oldest, t) => t.created_at < oldest ? t.created_at : oldest, reviewTasks[0].created_at)
    : null

  // 4. Accept Applicants — pending applicants across every open posting
  const scopedPostings = scope ? postings.filter(p => p.department_id != null && scope.ids.has(p.department_id)) : postings
  const postingsWithPending = scopedPostings.filter(p => p.pending_count > 0)
  const applicantLists = await Promise.all(postingsWithPending.map(p => recruitmentService.getApplicants(p.id)))
  const pendingApplicants = applicantLists.flat().filter(a => a.status === 'pending')
  const applicantOldest = pendingApplicants.length > 0
    ? pendingApplicants.reduce((oldest, a) => a.applied_at < oldest ? a.applied_at : oldest, pendingApplicants[0].applied_at)
    : null

  // 5. Approve Job Postings
  const approvalOldest = pendingApprovalPostings.length > 0
    ? pendingApprovalPostings.reduce((oldest, p) => p.created_at < oldest ? p.created_at : oldest, pendingApprovalPostings[0].created_at)
    : null

  const items: WaitingOnYouItem[] = [
    { id: 'shift_swap', label: 'Handle Shift Swaps', count: pendingSwaps.length, oldest_at: swapOldest, detail: null },
    { id: 'off_day_deadline', label: 'Schedule Next Week', count: offDayCount, oldest_at: offDayOldest, detail: offDayDetail },
    // Approving job postings is O/P-only (UC42) — a Manager viewer never gets that card.
    ...(scope ? [] : [{ id: 'job_posting_approval', label: 'Review Job Postings', count: pendingApprovalPostings.length, oldest_at: approvalOldest, detail: null } as WaitingOnYouItem]),
    { id: 'applicant_accept', label: 'Review Applicants', count: pendingApplicants.length, oldest_at: applicantOldest, detail: null },
    { id: 'task_review', label: 'Manage Tasks', count: reviewTasks.length, oldest_at: reviewOldest, detail: null },
  ]

  // Priority-among-pending: keep the fixed 5-slot priority order for anything still pending,
  // demote cleared (count === 0) categories to the bottom instead of leaving them in their slot.
  const pending = items.filter(i => i.count > 0)
  const cleared = items.filter(i => i.count === 0)
  return [...pending, ...cleared]
}

async function buildTaskOverview(company_id: string, owner_id: string): Promise<TaskOverviewGroup[]> {
  const [kanban, delayAlerts] = await Promise.all([
    taskService.getKanbanTasks(company_id, owner_id),
    taskService.getTaskDelayAlerts(company_id, undefined, owner_id),
  ])

  // Sub-tasks are excluded everywhere: they have no card of their own on the Kanban board, so a
  // dashboard row for one could never be shown/highlighted on the Task page it deep-links to.
  const topLevel = (tasks: Task[]) => tasks.filter(t => !t.parent_task_id)
  const openTasks = [...topLevel(kanban.Assigned), ...topLevel(kanban['In Progress'])]
  const now = Date.now()
  const todayKey = formatDateKey(new Date())

  // Longest-overdue first — the task that has been waiting the longest needs attention first.
  const overdue = openTasks
    .filter(t => t.due_at && new Date(t.due_at).getTime() < now)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())
  const overdueIds = new Set(overdue.map(t => t.id))
  const completedToday = topLevel(kanban.Complete).filter(t => {
    const stamp = t.completed_at ?? t.updated_at
    return stamp ? formatDateKey(new Date(stamp)) === todayKey : false
  })

  const delayedById = new Map(openTasks.map(t => [t.id, t]))
  const delayedTasks = delayAlerts.map(a => delayedById.get(a.task_id)).filter((t): t is Task => !!t)
  const rowedTasks = [...overdue, ...completedToday, ...delayedTasks]

  const nameLookupIds = new Set<string>()
  const deptLookupIds = new Set<string>()
  for (const t of rowedTasks) {
    if (t.assigned_user_id) nameLookupIds.add(t.assigned_user_id)
    if (t.department_id) deptLookupIds.add(t.department_id)
  }
  const [users, depts] = await Promise.all([
    nameLookupIds.size > 0 ? attendanceRepository.getUsersByIds([...nameLookupIds]) : Promise.resolve([]),
    deptLookupIds.size > 0 ? attendanceRepository.getDepartmentsByIds([...deptLookupIds]) : Promise.resolve([]),
  ])
  const userById = new Map(users.map(u => [u.id, u]))
  const deptNameById = new Map(depts.map(d => [d.id, d.name]))

  const toRow = (t: Task): TaskOverviewRow => ({
    id: t.id,
    title: t.title,
    assignee_name: t.assigned_user_id ? userById.get(t.assigned_user_id)?.full_name ?? 'Unassigned' : 'Unassigned',
    assignee_photo_url: t.assigned_user_id ? userById.get(t.assigned_user_id)?.profile_photo_url ?? null : null,
    department_id: t.department_id ?? null,
    department_name: t.department_id ? deptNameById.get(t.department_id) ?? null : null,
    due_at: t.due_at ?? null,
    completed_at: t.completed_at ?? t.updated_at ?? null,
  })

  // A task can be both overdue and still delay-alerted (percent_elapsed keeps climbing past 100
  // once it crosses the deadline unstarted) — Overdue is the more severe bucket, so it wins and
  // the task is excluded here rather than double-counted in both groups.
  const delayRows: TaskOverviewRow[] = delayAlerts
    .filter(alert => !overdueIds.has(alert.task_id) && delayedById.has(alert.task_id))
    .map(alert => toRow(delayedById.get(alert.task_id)!))

  return [
    { key: 'overdue', label: 'Overdue', count: overdue.length, tasks: overdue.map(toRow) },
    { key: 'delay_alert', label: 'Delay Alert', count: delayRows.length, tasks: delayRows },
    { key: 'completed', label: 'Completed', count: completedToday.length, tasks: completedToday.map(toRow) },
  ]
}

// Shared by both Attendance Overview halves — groups today's assignments by department and
// classifies each person into Late / Not Started / Absent (checked-in-on-time people only count
// toward the progress numbers), reusing the same exceptions the Attendance page computes.
function classifyAttendance(
  records: Awaited<ReturnType<typeof attendanceService.getAttendanceByDateRange>>,
  roles: string[],
): AttendanceRoleGroup {
  const rows = records.filter(r => roles.includes(r.assignee_role))
  const deptsByName = new Map<string, AttendanceDepartmentGroup>()
  let checkedIn = 0

  for (const row of rows) {
    const deptName = row.department_name ?? 'General'
    let dept = deptsByName.get(deptName)
    if (!dept) {
      dept = { department_id: row.shift.department_id ?? null, department_name: deptName, expected: 0, checked_in: 0, present: [], late: [], not_started: [], absent: [] }
      deptsByName.set(deptName, dept)
    }
    dept.expected += 1
    if (row.record?.clock_in_time) { checkedIn += 1; dept.checked_in += 1 }

    const shiftStart = row.shift.start_time.slice(0, 5)
    const person: AttendancePersonRow = {
      user_id: row.assignment.user_id,
      name: row.assignee_name,
      shift_start: shiftStart,
      clock_in_label: null,
      minutes_late: null,
    }

    if (row.exceptions.includes('absent')) {
      dept.absent.push(person)
      continue
    }
    if (row.exceptions.includes('late')) {
      const clockIn = row.record?.clock_in_time ? new Date(row.record.clock_in_time) : null
      const scheduled = combineDateTime(row.shift.shift_date, row.shift.start_time)
      person.clock_in_label = clockIn
        ? clockIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
        : null
      person.minutes_late = clockIn ? Math.max(0, Math.round((clockIn.getTime() - scheduled.getTime()) / 60_000)) : null
      dept.late.push(person)
      continue
    }
    if (!row.record?.clock_in_time) {
      dept.not_started.push(person)
      continue
    }
    person.clock_in_label = new Date(row.record.clock_in_time)
      .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
    dept.present.push(person)
  }

  const departments = [...deptsByName.values()].sort((a, b) => a.department_name.localeCompare(b.department_name))
  for (const dept of departments) {
    dept.not_started.sort((a, b) => a.shift_start.localeCompare(b.shift_start))
  }
  return { expected: rows.length, checked_in: checkedIn, departments }
}

async function buildAttendanceOverview(company_id: string, scope: DeptScope): Promise<AttendanceOverview> {
  const todayKey = formatDateKey(new Date())
  const allRecords = await attendanceService.getAttendanceByDateRange(company_id, todayKey, todayKey)
  const records = scope ? allRecords.filter(r => r.department_name != null && scope.names.has(r.department_name)) : allRecords
  return {
    internal: classifyAttendance(records, ['Manager', 'Employee']),
    casual: classifyAttendance(records, ['Casual Worker']),
  }
}

async function buildRecruitmentOverview(company_id: string, scope: DeptScope): Promise<RecruitmentOverview> {
  const allPostings = await recruitmentService.getJobPostings(company_id)
  const postings = scope ? allPostings.filter(p => p.department_id != null && scope.ids.has(p.department_id)) : allPostings
  const open = postings.filter(p => p.status === 'open')
  const todayKey = formatDateKey(new Date())

  const deadlineToday = open
    .filter(p => p.expires_at && formatDateKey(new Date(p.expires_at)) === todayKey)
    .map(p => ({ job_id: p.id, title: p.title, confirmed_count: p.confirmed_count, openings: p.openings ?? 0 }))

  const startingSoon = open
    .filter(p => {
      if (!p.shift_date) return false
      const days = daysBetween(todayKey, p.shift_date)
      return days >= 0 && days <= STARTING_SOON_DAYS && p.confirmed_count < (p.openings ?? 0)
    })
    .map(p => ({
      job_id: p.id,
      title: p.title,
      confirmed_count: p.confirmed_count,
      openings: p.openings ?? 0,
      shift_date: p.shift_date!,
      days_until_start: daysBetween(todayKey, p.shift_date!),
    }))

  return { deadline_today: deadlineToday, starting_soon: startingSoon }
}

export const ownerDashboardService = {
  async getDashboardSummary(company_id: string, owner_id: string, viewer_role?: string): Promise<OwnerDashboardSummary> {
    if (!company_id) throw new Error('company_id is required')
    if (!owner_id) throw new Error('owner_id is required')

    let scope: DeptScope = null
    if (viewer_role === 'Manager') {
      const depts = await ownerTeamService.getManagerDepartments(owner_id, company_id)
      scope = { ids: new Set(depts.map(d => d.department_id)), names: new Set(depts.map(d => d.department_name)) }
    }

    const [waitingOnYou, taskOverview, attendanceOverview, recruitmentOverview] = await Promise.all([
      buildWaitingOnYou(company_id, owner_id, scope),
      buildTaskOverview(company_id, owner_id),
      buildAttendanceOverview(company_id, scope),
      buildRecruitmentOverview(company_id, scope),
    ])

    return {
      waiting_on_you: waitingOnYou,
      task_overview: taskOverview,
      attendance_overview: attendanceOverview,
      recruitment_overview: recruitmentOverview,
    }
  },
}
