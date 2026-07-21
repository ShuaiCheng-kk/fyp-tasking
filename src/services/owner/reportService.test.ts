import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {}, createClient: () => ({}) }))
vi.mock('@/repositories/owner/reportRepository', () => ({
  reportRepository: {
    getDepartments: vi.fn(),
    getDepartmentManagers: vi.fn(),
    getShifts: vi.fn(),
    getAssignmentsByShiftIds: vi.fn(),
    getTasksInRange: vi.fn(),
    getTasksByDeadlineRange: vi.fn(),
    getAttendanceByAssignmentIds: vi.fn(),
    getPriorAttendedCasualUserIds: vi.fn(),
    getLifetimeCompletedShiftsByUserIds: vi.fn(),
    getWorkerCancellationsInRange: vi.fn(),
    getUsersByIds: vi.fn(),
    getJobPostingsCreatedInRange: vi.fn(),
    getApplicantsByJobIds: vi.fn(),
    getInvitationsByJobIds: vi.fn(),
  },
}))
vi.mock('@/repositories/owner/recruitmentRepository', () => ({
  recruitmentRepository: {
    getVerifiedPoolWorkers: vi.fn(),
  },
}))

import { reportRepository } from '@/repositories/owner/reportRepository'
import { recruitmentRepository } from '@/repositories/owner/recruitmentRepository'
import { previousPeriod, reportService } from '@/services/owner/reportService'

const FILTERS = {
  company_id: 'company-1',
  date_from: '2026-07-07',
  date_to: '2026-07-13',
  department_id: null,
}

// Only the current period returns data; the previous period comes back empty so the
// trend baseline is exercised too (all-null rates, zero cost).
const inCurrentPeriod = (filters: { date_from: string }) => filters.date_from === FILTERS.date_from

const shifts = [
  // 8h shift, no flat rate — hourly costing
  { id: 's1', company_id: 'company-1', department_id: 'd1', shift_date: '2026-07-08', start_time: '09:00:00', end_time: '17:00:00', flat_rate: null },
  // 4h shift with a flat rate of 100 per assignment
  { id: 's2', company_id: 'company-1', department_id: 'd1', shift_date: '2026-07-09', start_time: '09:00:00', end_time: '13:00:00', flat_rate: 100 },
]

const assignments = [
  // cw1 worked s1: on time (within 10-min grace), 09:05→17:00 minus 30-min break
  { id: 'a1', shift_id: 's1', user_id: 'cw1', assignment_status: 'accepted' },
  // internal employee on s1: no clocking, costed at scheduled hours
  { id: 'a2', shift_id: 's1', user_id: 'emp1', assignment_status: 'accepted' },
  // cw2 worked s2: clocked in 20 min late → late; flat rate applies
  { id: 'a3', shift_id: 's2', user_id: 'cw2', assignment_status: 'accepted' },
  // cw1 rejected s2 → counted as a rejected shift, no attendance judgement, no cost
  { id: 'a4', shift_id: 's2', user_id: 'cw1', assignment_status: 'rejected' },
  // cw2 never clocked in on s1 (shift already over) → absent, no cost
  { id: 'a5', shift_id: 's1', user_id: 'cw2', assignment_status: 'accepted' },
]

const attendance = [
  {
    id: 'r1', shift_assignment_id: 'a1', casual_worker_id: 'cw1',
    clock_in_time: '2026-07-08T09:05:00Z', clock_out_time: '2026-07-08T17:00:00Z',
    break_in_time: '2026-07-08T12:00:00Z', break_out_time: '2026-07-08T12:30:00Z',
    owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
  },
  {
    id: 'r2', shift_assignment_id: 'a3', casual_worker_id: 'cw2',
    clock_in_time: '2026-07-09T09:20:00Z', clock_out_time: '2026-07-09T13:00:00Z',
    break_in_time: null, break_out_time: null,
    owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
  },
]

const users = [
  { id: 'cw1', full_name: 'Casual One', role: 'Casual Worker', hourly_rate: 10, skills: 'Barista, Cashier' },
  { id: 'cw2', full_name: 'Casual Two', role: 'Casual Worker', hourly_rate: null, skills: 'barista, Waiter' },
  { id: 'emp1', full_name: 'Employee One', role: 'Employee', hourly_rate: 20, skills: null },
  { id: 'mgr1', full_name: 'Mandy Manager', role: 'Manager', hourly_rate: null, skills: null },
]

// Fixtures for the On-time Task Completion Rate KPI — filtered by DEADLINE (due_at), not
// created/task_date, and scoped to Manager+Employee assignees only.
const deadlineTasks = [
  // emp1 (Employee) — completed before its deadline → on time
  { id: 'dt1', department_id: 'd1', assigned_user_id: 'emp1', parent_task_id: null, is_archived: false, status: 'Complete', due_at: '2026-07-08T12:00:00Z', completed_at: '2026-07-08T10:00:00Z' },
  // emp1 (Employee) — completed after its deadline → counted, not on time
  { id: 'dt2', department_id: 'd1', assigned_user_id: 'emp1', parent_task_id: null, is_archived: false, status: 'Complete', due_at: '2026-07-09T12:00:00Z', completed_at: '2026-07-10T10:00:00Z' },
  // mgr1 (Manager) — deadline in range, still open → counted, not on time
  { id: 'dt5', department_id: 'd1', assigned_user_id: 'mgr1', parent_task_id: null, is_archived: false, status: 'In Progress', due_at: '2026-07-11T12:00:00Z', completed_at: null },
  // cw1 (Casual Worker) — excluded entirely, even though it's on time and in range
  { id: 'dt3', department_id: 'd1', assigned_user_id: 'cw1', parent_task_id: null, is_archived: false, status: 'Complete', due_at: '2026-07-08T12:00:00Z', completed_at: '2026-07-08T09:00:00Z' },
  // emp1 — deadline falls OUTSIDE the selected period → excluded even though created in-period
  { id: 'dt4', department_id: 'd1', assigned_user_id: 'emp1', parent_task_id: null, is_archived: false, status: 'Complete', due_at: '2026-07-20T12:00:00Z', completed_at: '2026-07-19T09:00:00Z' },
  // sub-task — excluded (top-level only)
  { id: 'dt6', department_id: 'd1', assigned_user_id: 'emp1', parent_task_id: 'dt1', is_archived: false, status: 'Complete', due_at: '2026-07-08T12:00:00Z', completed_at: '2026-07-08T09:00:00Z' },
  // archived — excluded
  { id: 'dt7', department_id: 'd1', assigned_user_id: 'emp1', parent_task_id: null, is_archived: true, status: 'Complete', due_at: '2026-07-08T12:00:00Z', completed_at: '2026-07-08T09:00:00Z' },
]

const tasks = [
  // completed before its deadline → on time
  { id: 't1', department_id: 'd1', parent_task_id: null, is_archived: false, status: 'Complete', due_at: '2026-07-10T17:00:00Z', completed_at: '2026-07-09T10:00:00Z', rejected_at: null },
  // completed after its deadline → not on time
  { id: 't2', department_id: 'd1', parent_task_id: null, is_archived: false, status: 'Complete', due_at: '2026-07-08T17:00:00Z', completed_at: '2026-07-09T10:00:00Z', rejected_at: null },
  // deadline passed, still open → overdue
  { id: 't3', department_id: 'd1', parent_task_id: null, is_archived: false, status: 'In Progress', due_at: '2026-07-01T17:00:00Z', completed_at: null, rejected_at: null },
  // was rejected back for rework
  { id: 't4', department_id: 'd1', parent_task_id: null, is_archived: false, status: 'In Progress', due_at: null, completed_at: null, rejected_at: '2026-07-10T09:00:00Z' },
  // sub-task and archived task must not count
  { id: 't5', department_id: 'd1', parent_task_id: 't1', is_archived: false, status: 'Complete', due_at: null, completed_at: null, rejected_at: null },
  { id: 't6', department_id: 'd1', parent_task_id: null, is_archived: true, status: 'Complete', due_at: null, completed_at: null, rejected_at: null },
]

const postings = [
  { id: 'p1', title: 'Server', department_id: 'd1', status: 'closed', openings: 2, created_at: '2026-07-07T10:00:00Z' },
  { id: 'p2', title: 'Runner', department_id: null, status: 'open', openings: null, created_at: '2026-07-08T10:00:00Z' },
]

const applicants = [
  { id: 'ap1', job_id: 'p1', status: 'accepted' },
  { id: 'ap2', job_id: 'p1', status: 'pending' },
  { id: 'ap3', job_id: 'p1', status: 'rejected' },
]

const invitations = [
  { job_id: 'p1', applicant_id: 'ap1', status: 'accepted', sent_at: '2026-07-08T09:00:00Z', responded_at: '2026-07-09T10:00:00Z' },
  { job_id: 'p1', applicant_id: 'ap2', status: 'accepted', sent_at: '2026-07-08T09:00:00Z', responded_at: null },
  { job_id: 'p1', applicant_id: 'ap3', status: 'declined', sent_at: '2026-07-08T09:00:00Z', responded_at: '2026-07-08T12:00:00Z' },
]

const pool = [
  { id: 'cw1', full_name: 'Casual One', email_address: 'c1@x.com', phone_number: null, profile_photo_url: null, skills: 'Barista', department_id: 'd1', department_name: 'Ops', verified_at: '2026-06-01T00:00:00Z', completed_shifts: 5, last_worked_date: '2026-07-08' },
  { id: 'cw9', full_name: 'Casual Nine', email_address: 'c9@x.com', phone_number: null, profile_photo_url: null, skills: null, department_id: 'd2', department_name: 'Mkt', verified_at: '2026-06-10T00:00:00Z', completed_shifts: 2, last_worked_date: '2026-07-01' },
]

function primeMocks() {
  vi.mocked(reportRepository.getDepartments).mockResolvedValue([{ id: 'd1', name: 'Operations' }])
  vi.mocked(reportRepository.getDepartmentManagers).mockResolvedValue([{ department_id: 'd1', manager_name: 'Mandy Manager' }])
  vi.mocked(reportRepository.getShifts).mockImplementation(async f => (inCurrentPeriod(f) ? shifts : []) as never)
  vi.mocked(reportRepository.getAssignmentsByShiftIds).mockImplementation(async ids => (ids.length ? assignments : []) as never)
  vi.mocked(reportRepository.getTasksInRange).mockImplementation(async f => (inCurrentPeriod(f) ? tasks : []) as never)
  vi.mocked(reportRepository.getTasksByDeadlineRange).mockImplementation(async f => (inCurrentPeriod(f) ? deadlineTasks : []) as never)
  vi.mocked(reportRepository.getAttendanceByAssignmentIds).mockImplementation(async ids => (ids.length ? attendance : []) as never)
  // Only cw1 has attended a shift before the selected period — cw2 is a first-time worker.
  vi.mocked(reportRepository.getPriorAttendedCasualUserIds).mockImplementation(async (_company, ids) => (ids.includes('cw1') ? ['cw1'] : []))
  // Lifetime (all-time) completed shifts per worker — powers "Rehire Count by Worker".
  vi.mocked(reportRepository.getLifetimeCompletedShiftsByUserIds).mockImplementation(async (_company, ids) => (
    ids.map(id => ({ user_id: id, completed_shifts: id === 'cw1' ? 5 : 2 }))
  ))
  vi.mocked(reportRepository.getWorkerCancellationsInRange).mockResolvedValue([])
  vi.mocked(reportRepository.getUsersByIds).mockImplementation(async ids => (ids.length ? users : []) as never)
  vi.mocked(reportRepository.getJobPostingsCreatedInRange).mockImplementation(async f => (inCurrentPeriod(f) ? postings : []) as never)
  vi.mocked(reportRepository.getApplicantsByJobIds).mockImplementation(async ids => (ids.length ? applicants : []) as never)
  vi.mocked(reportRepository.getInvitationsByJobIds).mockImplementation(async ids => (ids.length ? invitations : []) as never)
  vi.mocked(recruitmentRepository.getVerifiedPoolWorkers).mockResolvedValue(pool as never)
}

describe('previousPeriod', () => {
  it('returns the immediately preceding window of the same length', () => {
    expect(previousPeriod({ date_from: '2026-07-07', date_to: '2026-07-13' }))
      .toEqual({ date_from: '2026-06-30', date_to: '2026-07-06' })
  })

  it('handles a single-day period', () => {
    expect(previousPeriod({ date_from: '2026-07-13', date_to: '2026-07-13' }))
      .toEqual({ date_from: '2026-07-12', date_to: '2026-07-12' })
  })

  it('crosses month boundaries correctly', () => {
    expect(previousPeriod({ date_from: '2026-07-01', date_to: '2026-07-03' }))
      .toEqual({ date_from: '2026-06-28', date_to: '2026-06-30' })
  })
})

describe('reportService.getCompanyReport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-14T12:00:00Z'))
    primeMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('judges attendance only for casual workers on ended, non-rejected assignments', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    // Countable: a1 (present), a3 (present but late), a5 (absent). a2 is internal, a4 rejected.
    expect(report.overview.attendance_rate).toBe(67) // 2 of 3
    const dept = report.departments.find(d => d.department_id === 'd1')!
    expect(dept.late_count).toBe(1)
    expect(dept.absent_count).toBe(1)
  })

  it('computes On-time Attendance Rate for Manager+Employee only, excluding Casual Workers', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    // Only a2 (emp1) is internal; s1 has ended and emp1 never clocked in → absent, countable.
    expect(report.overview.on_time_attendance_rate).toBe(0)
    expect(report.overview.on_time_attendance_late_rate).toBe(0)
    expect(report.overview.on_time_attendance_absent_rate).toBe(100)
  })

  it('counts internal attendance by record, not by headcount, and splits present/late/absent on the same denominator', async () => {
    const manyAssignments = [
      ...assignments,
      { id: 'a6', shift_id: 's2', user_id: 'emp1', assignment_status: 'accepted' },
    ]
    const manyAttendance = [
      ...attendance,
      // emp1 on s1 (a2): on time
      { id: 'r3', shift_assignment_id: 'a2', casual_worker_id: 'emp1', clock_in_time: '2026-07-08T09:00:00Z', clock_out_time: '2026-07-08T17:00:00Z', break_in_time: null, break_out_time: null, owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null },
      // emp1 on s2 (a6): clocked in 20 min late
      { id: 'r4', shift_assignment_id: 'a6', casual_worker_id: 'emp1', clock_in_time: '2026-07-09T09:20:00Z', clock_out_time: '2026-07-09T13:00:00Z', break_in_time: null, break_out_time: null, owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null },
    ]
    vi.mocked(reportRepository.getAssignmentsByShiftIds).mockImplementation(async ids => (ids.length ? manyAssignments : []) as never)
    vi.mocked(reportRepository.getAttendanceByAssignmentIds).mockImplementation(async ids => (ids.length ? manyAttendance : []) as never)

    const report = await reportService.getCompanyReport(FILTERS)
    // 2 attendance records for emp1 (a2 present, a6 late) → 100% countable, 50% present, 50% late
    expect(report.overview.on_time_attendance_rate).toBe(50)
    expect(report.overview.on_time_attendance_late_rate).toBe(50)
    expect(report.overview.on_time_attendance_absent_rate).toBe(0)
  })

  it('computes On-time Task Completion Rate by deadline (not created date), Manager+Employee only', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    // Countable (deadline in range, Manager/Employee): dt1 (on time), dt2 (late), dt5 (still open).
    // Excluded: dt3 (Casual Worker), dt4 (deadline outside range), dt6 (sub-task), dt7 (archived).
    expect(report.overview.on_time_task_completion_rate).toBe(33) // 1 of 3
    const dept = report.departments.find(d => d.department_id === 'd1')!
    expect(dept.internal_task_on_time_rate).toBe(33)
  })

  it('computes department-level internal attendance rate and casual labor cost breakdowns', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    const dept = report.departments.find(d => d.department_id === 'd1')!
    // Same single internal record (emp1 absent on s1) as the company-wide On-time Attendance test.
    expect(dept.internal_attendance_rate).toBe(0)
    // a1 (cw1, $74.17) + a3 (cw2, $100 flat) — both Casual Worker, both on d1.
    expect(dept.casual_labor_cost).toBeCloseTo(174.17, 2)
  })

  it('builds per-worker reliability rows sorted by problems first', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    const cw2 = report.casual.workers.find(w => w.user_id === 'cw2')!
    expect(cw2).toMatchObject({ worked: 1, late: 1, absent: 1, rejected_shifts: 0 })
    const cw1 = report.casual.workers.find(w => w.user_id === 'cw1')!
    expect(cw1).toMatchObject({ worked: 1, late: 0, absent: 0, rejected_shifts: 1 })
    // cw2 (2 problems) ranks above cw1 (1 problem)
    expect(report.casual.workers[0].user_id).toBe('cw2')
  })

  it('computes labor cost from real rates and hours only — no pay for rejected or absent', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    // a1: cw1 hourly 10 × (09:05→17:00 − 30min break = 7.4167h) = 74.17
    // a2: emp1 hourly 20 × scheduled 8h = 160
    // a3: flat rate 100
    // a4 rejected + a5 absent: nothing owed
    expect(report.overview.labor_cost).toBeCloseTo(334.17, 2)
    expect(report.casual.labor_cost).toBeCloseTo(174.17, 2)
    expect(report.overview.total_casual_worker_cost).toBeCloseTo(174.17, 2)
    expect(report.previous_overview.total_casual_worker_cost).toBe(0)
    expect(report.overview.uncosted_assignments).toBe(0)
    const dept = report.departments.find(d => d.department_id === 'd1')!
    expect(dept.labor_cost).toBeCloseTo(334.17, 2)
  })

  it('excludes a Casual Worker who clocked in but never completed clock-out from Total Casual Worker Cost', async () => {
    const noCheckoutAssignments = [
      ...assignments,
      // cw1 clocks in for s2 (flat rate 100) but never clocks out — not "actually attended"
      { id: 'a6', shift_id: 's2', user_id: 'cw1', assignment_status: 'accepted' },
    ]
    const noCheckoutAttendance = [
      ...attendance,
      { id: 'r3', shift_assignment_id: 'a6', casual_worker_id: 'cw1', clock_in_time: '2026-07-09T09:05:00Z', clock_out_time: null, break_in_time: null, break_out_time: null, owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null },
    ]
    vi.mocked(reportRepository.getAssignmentsByShiftIds).mockImplementation(async ids => (ids.length ? noCheckoutAssignments : []) as never)
    vi.mocked(reportRepository.getAttendanceByAssignmentIds).mockImplementation(async ids => (ids.length ? noCheckoutAttendance : []) as never)

    const report = await reportService.getCompanyReport(FILTERS)
    // a6 would otherwise add another $100 (s2's flat rate) — excluded since clock-out never happened
    expect(report.casual.labor_cost).toBeCloseTo(174.17, 2)
  })

  it('counts a payable assignment with no rate as uncosted instead of guessing', async () => {
    vi.mocked(reportRepository.getUsersByIds).mockImplementation(async ids => (
      ids.length ? users.map(u => (u.id === 'emp1' ? { ...u, hourly_rate: null } : u)) : []
    ) as never)
    const report = await reportService.getCompanyReport(FILTERS)
    expect(report.overview.uncosted_assignments).toBe(1)
    expect(report.overview.labor_cost).toBeCloseTo(174.17, 2)
  })

  it('computes task metrics from top-level, non-archived tasks only', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    const dept = report.departments.find(d => d.department_id === 'd1')!
    expect(dept.tasks_total).toBe(4)
    expect(dept.tasks_completed).toBe(2)
    expect(dept.on_time_rate).toBe(50) // t1 on time, t2 late
    expect(dept.rework_count).toBe(1)  // t4
    expect(dept.overdue_open).toBe(1)  // t3
    expect(report.overview.on_time_completion_rate).toBe(50)
    expect(report.overview.total_tasks).toBe(4)
  })

  it('builds the recruitment funnel, fill rate and days-to-fill from real timestamps', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    expect(report.casual.funnel).toEqual({ applied: 3, accepted: 1, confirmed: 2 })
    expect(report.casual.fill_rate).toBe(100) // 2 confirmed of 2 openings
    expect(report.overview.total_hires).toBe(2)
    const p1 = report.casual.postings.find(p => p.posting_id === 'p1')!
    expect(p1.days_to_fill).toBeCloseTo(2, 2) // 07-07T10:00 → 07-09T10:00
    expect(p1.department_id).toBe('d1')
    const p2 = report.casual.postings.find(p => p.posting_id === 'p2')!
    expect(p2.days_to_fill).toBeNull() // no openings defined → never "filled"
  })

  it('computes Hiring Success Rate from Closed postings only, weighted by position count', async () => {
    const closedFull = { id: 'h1', title: 'Cashier', department_id: 'd1', status: 'closed', openings: 2, created_at: '2026-07-07T10:00:00Z' }
    const closedPartial = { id: 'h2', title: 'Waiter', department_id: 'd1', status: 'closed', openings: 5, created_at: '2026-07-08T10:00:00Z' }
    const stillOpen = { id: 'h3', title: 'Cook', department_id: 'd1', status: 'open', openings: 3, created_at: '2026-07-09T10:00:00Z' }
    const hiringInvitations = [
      { job_id: 'h1', applicant_id: 'x1', status: 'accepted', sent_at: '2026-07-07T11:00:00Z', responded_at: '2026-07-08T11:00:00Z' },
      { job_id: 'h1', applicant_id: 'x2', status: 'accepted', sent_at: '2026-07-07T11:00:00Z', responded_at: '2026-07-08T12:00:00Z' },
      { job_id: 'h2', applicant_id: 'x3', status: 'accepted', sent_at: '2026-07-08T11:00:00Z', responded_at: '2026-07-09T11:00:00Z' },
      { job_id: 'h2', applicant_id: 'x4', status: 'accepted', sent_at: '2026-07-08T11:00:00Z', responded_at: '2026-07-09T12:00:00Z' },
      { job_id: 'h2', applicant_id: 'x5', status: 'accepted', sent_at: '2026-07-08T11:00:00Z', responded_at: '2026-07-09T13:00:00Z' },
      // h3 is still Open — must not count even though it has an accepted invitation
      { job_id: 'h3', applicant_id: 'x6', status: 'accepted', sent_at: '2026-07-09T11:00:00Z', responded_at: '2026-07-09T12:00:00Z' },
    ]
    vi.mocked(reportRepository.getJobPostingsCreatedInRange).mockImplementation(async f => (inCurrentPeriod(f) ? [closedFull, closedPartial, stillOpen] : []) as never)
    vi.mocked(reportRepository.getApplicantsByJobIds).mockImplementation(async () => [])
    vi.mocked(reportRepository.getInvitationsByJobIds).mockImplementation(async ids => (ids.length ? hiringInvitations : []) as never)

    const report = await reportService.getCompanyReport(FILTERS)
    // h1: 2/2 hired (fully filled). h2: 3/5 hired (partial). h3 excluded (still Open).
    // Requested = 2 + 5 = 7. Hired = 2 + 3 = 5. Rate = 5/7 ≈ 71%.
    expect(report.overview.hiring_success_rate).toBe(71)
    // Only h1 is fully filled → Average Time to Fill is h1's own days_to_fill.
    // 2026-07-07T10:00 → last accept 2026-07-08T12:00 = 1.0833 days.
    expect(report.overview.average_time_to_fill_days).toBeCloseTo(1.08, 2)
    // All three postings are on d1 — the department breakdown matches the company-wide figures.
    const dept = report.departments.find(d => d.department_id === 'd1')!
    expect(dept.hiring_success_rate).toBe(71)
    expect(dept.average_time_to_fill_days).toBeCloseTo(1.08, 2)
    expect(dept.hiring_positions_requested).toBe(7)
    expect(dept.hiring_positions_hired).toBe(5)
  })

  // ── Casual Worker Pool Analytics — all four KPIs count each worker once ──
  // Worked this period: cw1 (a1 present on time) and cw2 (a3 late, a5 absent). a4 is rejected.

  it('computes Rehire Rate per worker — prior attendance counts, first-timers do not', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    // cw1 attended a shift before the period (rehired); cw2 is first-time → 1 of 2.
    expect(report.overview.casual_rehire_rate).toBe(50)
    expect(reportRepository.getPriorAttendedCasualUserIds).toHaveBeenCalledWith(
      'company-1', expect.arrayContaining(['cw1', 'cw2']), '2026-07-07',
    )
  })

  it('computes casual On-time Attendance Rate per worker — one Late or Absent disqualifies the worker', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    // cw1: every attendance Present. cw2: late once AND absent once → disqualified. 1 of 2.
    expect(report.overview.casual_on_time_attendance_rate).toBe(50)
  })

  it('computes casual On-time Task Completion Rate per worker, not per task', async () => {
    const withCasualTasks = [
      ...deadlineTasks,
      // cw2: one on-time task and one late task — the worker fails as a whole
      { id: 'ct1', department_id: 'd1', assigned_user_id: 'cw2', parent_task_id: null, is_archived: false, status: 'Complete', due_at: '2026-07-09T12:00:00Z', completed_at: '2026-07-09T10:00:00Z' },
      { id: 'ct2', department_id: 'd1', assigned_user_id: 'cw2', parent_task_id: null, is_archived: false, status: 'Complete', due_at: '2026-07-10T12:00:00Z', completed_at: '2026-07-11T10:00:00Z' },
    ]
    vi.mocked(reportRepository.getTasksByDeadlineRange).mockImplementation(async f => (inCurrentPeriod(f) ? withCasualTasks : []) as never)
    const report = await reportService.getCompanyReport(FILTERS)
    // Assigned ≥1 deadline-in-period task: cw1 (dt3 on time → pass), cw2 (ct2 late → fail). 1 of 2 —
    // per task it would be 2 of 3; per worker is what the pool KPI wants.
    expect(report.overview.casual_on_time_task_completion_rate).toBe(50)
  })

  it('computes Reliable Worker Rate — no late, no absence, all assigned tasks on time', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    // cw1: clean attendance + its only deadline task (dt3) on time → reliable. cw2: late+absent → not.
    expect(report.overview.casual_reliable_worker_rate).toBe(50)
  })

  it('strips Reliable status from an otherwise clean worker when one task finishes late', async () => {
    const withLateTask = deadlineTasks.map(t => (
      t.id === 'dt3' ? { ...t, completed_at: '2026-07-08T14:00:00Z' } : t // cw1's task now past its 12:00 deadline
    ))
    vi.mocked(reportRepository.getTasksByDeadlineRange).mockImplementation(async f => (inCurrentPeriod(f) ? withLateTask : []) as never)
    const report = await reportService.getCompanyReport(FILTERS)
    expect(report.overview.casual_reliable_worker_rate).toBe(0)
    // Attendance-only KPI is unaffected by the late task.
    expect(report.overview.casual_on_time_attendance_rate).toBe(50)
  })

  it('returns null casual pool rates when no casual worker worked in the period', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    expect(report.previous_overview.casual_rehire_rate).toBeNull()
    expect(report.previous_overview.casual_reliable_worker_rate).toBeNull()
    expect(report.previous_overview.casual_on_time_attendance_rate).toBeNull()
    expect(report.previous_overview.casual_on_time_task_completion_rate).toBeNull()
  })

  it('counts every shift assignment as "assigned", including rejected ones and no-shows', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    // cw1: a1 (accepted, s1) + a4 (rejected, s2) → 2 assigned, only 1 rejected.
    const cw1 = report.casual.workers.find(w => w.user_id === 'cw1')!
    expect(cw1.assigned_shifts).toBe(2)
    expect(cw1.rejected_shifts).toBe(1)
    // cw2: a3 (accepted, worked late) + a5 (accepted, absent) → 2 assigned, 0 rejected.
    const cw2 = report.casual.workers.find(w => w.user_id === 'cw2')!
    expect(cw2.assigned_shifts).toBe(2)
    expect(cw2.rejected_shifts).toBe(0)
  })

  it('counts a task returned for rework once per task, regardless of status', async () => {
    const withReturnedTask = deadlineTasks.map(t => (
      t.id === 'dt3' ? { ...t, rejected_at: '2026-07-08T11:00:00Z' } : t // cw1's task was sent back
    ))
    vi.mocked(reportRepository.getTasksByDeadlineRange).mockImplementation(async f => (inCurrentPeriod(f) ? withReturnedTask : []) as never)
    const report = await reportService.getCompanyReport(FILTERS)
    const cw1 = report.casual.workers.find(w => w.user_id === 'cw1')!
    expect(cw1.tasks_returned).toBe(1)
    const cw2 = report.casual.workers.find(w => w.user_id === 'cw2')!
    expect(cw2.tasks_returned).toBe(0)
  })

  it('counts confirmed-job cancellations against the worker who cancelled, from the date range only', async () => {
    vi.mocked(reportRepository.getWorkerCancellationsInRange).mockResolvedValue([
      { user_id: 'cw1' }, { user_id: 'cw1' }, { user_id: 'cw2' },
    ])
    const report = await reportService.getCompanyReport(FILTERS)
    expect(reportRepository.getWorkerCancellationsInRange).toHaveBeenCalledWith('company-1', '2026-07-07', '2026-07-14')
    const cw1 = report.casual.workers.find(w => w.user_id === 'cw1')!
    expect(cw1.cancellations).toBe(2)
    const cw2 = report.casual.workers.find(w => w.user_id === 'cw2')!
    expect(cw2.cancellations).toBe(1)
  })

  it('surfaces a worker who only cancelled — no shift assignment at all this period', async () => {
    // cw3 has no shift/task fixture anywhere — the repository lookup is the only thing that ever
    // mentions them, exercising the path where casualStats gets a row purely from a cancellation.
    const withCw3 = [...users, { id: 'cw3', full_name: 'Casual Three', role: 'Casual Worker', hourly_rate: null, skills: null }]
    vi.mocked(reportRepository.getUsersByIds).mockImplementation(async ids => (
      withCw3.filter(u => ids.includes(u.id)) as never
    ))
    vi.mocked(reportRepository.getWorkerCancellationsInRange).mockResolvedValue([{ user_id: 'cw3' }])
    const report = await reportService.getCompanyReport(FILTERS)
    const cw3 = report.casual.workers.find(w => w.user_id === 'cw3')!
    expect(cw3).toBeDefined()
    expect(cw3.full_name).toBe('Casual Three')
    expect(cw3.cancellations).toBe(1)
    expect(cw3.worked).toBe(0)
    expect(cw3.assigned_shifts).toBe(0)
  })

  // ── "by Worker" chart data — CasualReliabilityRow's per-worker continuous fields ──

  it('attaches lifetime rehire count and period on-time-attendance rate to each worked worker', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    const cw1 = report.casual.workers.find(w => w.user_id === 'cw1')!
    // cw1: lifetime completed_shifts mocked to 5; period attendance was present, not late → 100%.
    expect(cw1.rehire_count).toBe(5)
    expect(cw1.on_time_attendance_rate).toBe(100)
    // cw1's only deadline task (dt3) finished on time → 100%.
    expect(cw1.on_time_task_completion_rate).toBe(100)

    const cw2 = report.casual.workers.find(w => w.user_id === 'cw2')!
    // cw2: lifetime completed_shifts mocked to 2; period had 1 late + 1 absent → 0 of 2 on time.
    expect(cw2.rehire_count).toBe(2)
    expect(cw2.on_time_attendance_rate).toBe(0)
    // cw2 was assigned no deadline-in-period task in the default fixture.
    expect(cw2.on_time_task_completion_rate).toBeNull()

    expect(reportRepository.getLifetimeCompletedShiftsByUserIds).toHaveBeenCalledWith(
      'company-1', expect.arrayContaining(['cw1', 'cw2']),
    )
  })

  it('builds the Worker Skill Distribution from each worked worker\'s comma-split skills, deduped case-insensitively', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    // cw1: "Barista, Cashier". cw2: "barista, Waiter" — "barista"/"Barista" count as the same
    // skill (2 workers), each other skill counted once.
    const barista = report.casual.skill_distribution.find(s => s.skill.toLowerCase() === 'barista')!
    expect(barista.count).toBe(2)
    const cashier = report.casual.skill_distribution.find(s => s.skill === 'Cashier')!
    expect(cashier.count).toBe(1)
    const waiter = report.casual.skill_distribution.find(s => s.skill === 'Waiter')!
    expect(waiter.count).toBe(1)
  })

  it('returns null rates (not fake 0%) when a period has nothing to measure', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    expect(report.previous_overview.attendance_rate).toBeNull()
    expect(report.previous_overview.on_time_completion_rate).toBeNull()
    expect(report.previous_overview.recruitment_fill_rate).toBeNull()
    expect(report.previous_overview.on_time_attendance_rate).toBeNull()
    expect(report.previous_overview.labor_cost).toBe(0)
  })

  it('reports the period and the immediately preceding comparison period', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    expect(report.period).toEqual({ date_from: '2026-07-07', date_to: '2026-07-13' })
    expect(report.previous_period).toEqual({ date_from: '2026-06-30', date_to: '2026-07-06' })
  })

  it('names the department managers on each department row', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    const dept = report.departments.find(d => d.department_id === 'd1')!
    expect(dept.manager_names).toEqual(['Mandy Manager'])
  })

  it('maps the verified pool and honors the department filter', async () => {
    const all = await reportService.getCompanyReport(FILTERS)
    expect(all.casual.pool.map(w => w.user_id)).toEqual(['cw1', 'cw9'])
    expect(all.casual.pool[0]).toMatchObject({ completed_shifts: 5, skills: 'Barista', last_worked_date: '2026-07-08' })

    const scoped = await reportService.getCompanyReport({ ...FILTERS, department_id: 'd2' })
    expect(scoped.casual.pool.map(w => w.user_id)).toEqual(['cw9'])
  })
})
