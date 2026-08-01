// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualDashboardRepository } from '@/repositories/casual/casualDashboardRepository'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'
import { sgtTodayKey, sgtDateKeyPlusDays } from '@/lib/singaporeTime'
import { AttendanceRecord } from '@/types/Attendance'

export interface CurrentJobView {
  assignment_id: string
  shift_id: string
  company_id: string
  department_id: string
  title: string
  shift_date: string
  start_time: string
  end_time: string
  is_open_ended: boolean
  company_name: string | null
  location: string | null
  address: string | null
  department_name: string | null
  // The posting this job was hired from — lets the worker re-open the full job detail (pay,
  // description, requirements) from the dashboard. Null for shifts not created from a posting.
  job_posting_id: string | null
  // Read LIVE from the assignment's supervisor_employee_id (never snapshotted) — if the
  // supervisor is replaced before the shift, the worker must see the current person's contact.
  supervisor: {
    id: string
    full_name: string
    phone_number: string | null
    email_address: string
    profile_photo_url: string | null
  } | null
  // Who published the posting this job was hired from — an Owner, or a Manager whose posting
  // the Owner approved. Read live from job_postings.created_by; null for shifts with no posting.
  posted_by: {
    id: string
    full_name: string
    role: string
    phone_number: string | null
    email_address: string
    profile_photo_url: string | null
  } | null
  clock_in_time: string | null
  clock_out_time: string | null
  break_in_time: string | null
  break_out_time: string | null
  clock_out_released: boolean
  // BUG-081 follow-up: this company has deactivated the worker (Team page "Inactive"). The worker
  // can still work for other companies — this is per-company, not account-wide.
  company_banned: boolean
}

type UpcomingAssignment = Awaited<ReturnType<typeof casualDashboardRepository.getUpcomingAssignments>>[number]

// How many days ahead (inclusive of today) the dashboard's Upcoming Jobs timeline covers.
const UPCOMING_WINDOW_DAYS = 7

// A Casual Worker only ever works one job at a time. The current job stays anchored to TODAY as
// long as today has any assignment: the earliest one not yet clocked out of, or — once every job
// scheduled for today is done — the most recently completed one, so the worker can still review
// it (tasks, messages, clock times) for the rest of the day. It only jumps ahead to a future
// day's job once today has nothing left at all, i.e. once the calendar day actually rolls over
// (2026-07-31) — not the instant a same-day shift is clocked out. Shared by the dashboard (job
// card) and by work-action gates that must resolve the same current job (e.g. messaging the
// supervisor).
// `all` is the full sorted upcoming list (with attendance records) — the dashboard builds its
// 7-day timeline from it, so the current-job pick and the timeline can never disagree.
//
// Shift dates are Singapore-nominal by design (see attendanceGrace/casualAttendanceService,
// which parse shift date+time via sgtInstant) — this "from today onward" filter must use that
// same Singapore calendar day, or the two disagree for ~8 hours a day (a same-day shift can fail
// to appear on the dashboard at all even though Clock In would otherwise accept it once it's
// visible). See project memory module5-clockin-timezone-bug.
export async function findCurrentAssignment(userId: string): Promise<{
  assignment: UpcomingAssignment
  record: AttendanceRecord | null
  all: { assignment: UpcomingAssignment; record: AttendanceRecord | null }[]
} | null> {
  const todayKey = sgtTodayKey()
  const unsortedAssignments = await casualDashboardRepository.getUpcomingAssignments(userId, todayKey)

  // Earliest first — sorted here rather than trusted from the repository, since ordering across
  // a joined table isn't guaranteed by every query shape.
  const assignments = [...unsortedAssignments].sort((a, b) =>
    (a.shift.shift_date + a.shift.start_time).localeCompare(b.shift.shift_date + b.shift.start_time)
  )

  const records = await casualAttendanceRepository.getAttendanceRecordsByAssignmentIds(assignments.map(a => a.id))
  const recordsByAssignment = new Map(records.map(r => [r.shift_assignment_id, r]))

  // "Current" stays anchored to TODAY as long as today has any assignment at all — the earliest
  // one not yet clocked out of, or, once every one of today's is done, the most recently
  // completed one (so the worker can still review it: tasks, messages, clock times) — rather than
  // jumping straight to a future day's job the moment today's work finishes. Only when there is
  // nothing scheduled for today at all does it fall through to the earliest not-yet-completed
  // assignment on a later day (2026-07-31).
  const todays = assignments.filter(a => a.shift.shift_date === todayKey)
  const todaysActive = todays.find(a => !recordsByAssignment.get(a.id)?.clock_out_time)
  const todaysFallback = todaysActive ?? [...todays].reverse()[0]
  const chosen = todaysFallback ?? assignments.find(a => !recordsByAssignment.get(a.id)?.clock_out_time)
  if (!chosen) return null

  return {
    assignment: chosen,
    record: recordsByAssignment.get(chosen.id) ?? null,
    all: assignments.map(a => ({ assignment: a, record: recordsByAssignment.get(a.id) ?? null })),
  }
}

export const casualDashboardService = {
  async getDashboard(authId: string) {
    if (!authId) throw new Error('Missing user id')

    const user = await casualDashboardRepository.getUserByAuthId(authId)
    if (!user) {
      throw new Error('Casual worker not found')
    }

    const current = await findCurrentAssignment(user.id)
    if (!current) {
      return { user, current_job: null as CurrentJobView | null, upcoming_jobs: [] as CurrentJobView[] }
    }

    // The timeline shows every NOT-YET-COMPLETED job in the next 7 days (today inclusive), plus
    // any job already clocked out TODAY — a shift stays visible for the rest of the calendar day
    // it happened on (so the worker can still check their clocked times/tasks/messages after
    // finishing) and only drops off once the day rolls over, at which point it moves to
    // Attendance History instead (2026-07-31). The current job is always included even when it
    // starts beyond the window — otherwise a worker whose only job is next week would see an
    // empty dashboard.
    const todayKey = sgtTodayKey()
    const windowEndKey = sgtDateKeyPlusDays(UPCOMING_WINDOW_DAYS - 1)
    const timeline = current.all.filter(entry =>
      (!entry.record?.clock_out_time || entry.assignment.shift.shift_date === todayKey) &&
      (entry.assignment.shift.shift_date <= windowEndKey || entry.assignment.id === current.assignment.id)
    )

    const postingIds = [...new Set(timeline.map(e => e.assignment.shift.source_job_posting_id).filter((id): id is string => !!id))]
    const supervisorIds = [...new Set(timeline.map(e => e.assignment.supervisor_employee_id).filter((id): id is string => !!id))]
    // Postings first — their created_by ids (the Owner/Manager who posted) join the user fetch.
    const postings = await casualDashboardRepository.getJobPostingsByIds(postingIds)
    const posterIds = [...new Set(postings.map(p => p.created_by).filter((id): id is string => !!id))]
    const users = await casualDashboardRepository.getUsersByIds([...new Set([...supervisorIds, ...posterIds])])
    const postingById = new Map(postings.map(p => [p.id, p]))
    const userById = new Map(users.map(u => [u.id, u]))

    // Department comes off the shift itself (not the posting) — a shift can exist without a
    // source posting (e.g. a manually-created future shift), so this must resolve independently
    // of whether `job` below is null.
    const departmentIds = [...new Set(timeline.map(e => e.assignment.shift.department_id).filter((id): id is string => !!id))]
    const departments = await casualDashboardRepository.getDepartmentsByIds(departmentIds)
    const departmentById = new Map(departments.map(d => [d.id, d]))

    const uniqueCompanyIds = [...new Set(timeline.map(e => e.assignment.shift.company_id))]
    const bannedCompanyIds = new Set(
      (await Promise.all(uniqueCompanyIds.map(async companyId => (
        (await casualAttendanceRepository.isBannedByCompany(user.id, companyId)) ? companyId : null
      )))).filter((id): id is string => !!id)
    )

    const upcoming_jobs: CurrentJobView[] = timeline.map(({ assignment, record }) => {
      const job = assignment.shift.source_job_posting_id ? postingById.get(assignment.shift.source_job_posting_id) ?? null : null
      const supervisor = assignment.supervisor_employee_id ? userById.get(assignment.supervisor_employee_id) ?? null : null
      const poster = job?.created_by ? userById.get(job.created_by) ?? null : null
      return {
        assignment_id: assignment.id,
        shift_id: assignment.shift.id,
        company_id: assignment.shift.company_id,
        department_id: assignment.shift.department_id,
        title: job?.title ?? '',
        shift_date: assignment.shift.shift_date,
        start_time: assignment.shift.start_time,
        end_time: assignment.shift.end_time,
        is_open_ended: assignment.shift.is_open_ended,
        company_name: job?.company_name ?? null,
        location: job?.location ?? null,
        address: job?.address ?? null,
        department_name: departmentById.get(assignment.shift.department_id)?.name ?? null,
        job_posting_id: assignment.shift.source_job_posting_id,
        supervisor: supervisor
          ? { id: supervisor.id, full_name: supervisor.full_name, phone_number: supervisor.phone_number, email_address: supervisor.email_address, profile_photo_url: supervisor.profile_photo_url }
          : null,
        posted_by: poster
          ? { id: poster.id, full_name: poster.full_name, role: poster.role, phone_number: poster.phone_number, email_address: poster.email_address, profile_photo_url: poster.profile_photo_url }
          : null,
        clock_in_time: record?.clock_in_time ?? null,
        clock_out_time: record?.clock_out_time ?? null,
        break_in_time: record?.break_in_time ?? null,
        break_out_time: record?.break_out_time ?? null,
        clock_out_released: record?.clock_out_released ?? false,
        company_banned: bannedCompanyIds.has(assignment.shift.company_id),
      }
    })

    const current_job = upcoming_jobs.find(j => j.assignment_id === current.assignment.id) ?? null

    return { user, current_job, upcoming_jobs }
  },
}
