import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {}, createClient: () => ({}) }))
vi.mock('@/repositories/owner/reportRepository', () => ({
  reportRepository: {
    getDepartments: vi.fn(),
    getDepartmentManagers: vi.fn(),
    getShifts: vi.fn(),
    getAssignmentsByShiftIds: vi.fn(),
    getTasksInRange: vi.fn(),
    getAttendanceByAssignmentIds: vi.fn(),
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
  { id: 'cw1', full_name: 'Casual One', role: 'Casual Worker', hourly_rate: 10 },
  { id: 'cw2', full_name: 'Casual Two', role: 'Casual Worker', hourly_rate: null },
  { id: 'emp1', full_name: 'Employee One', role: 'Employee', hourly_rate: 20 },
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
  vi.mocked(reportRepository.getAttendanceByAssignmentIds).mockImplementation(async ids => (ids.length ? attendance : []) as never)
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
    expect(report.overview.uncosted_assignments).toBe(0)
    const dept = report.departments.find(d => d.department_id === 'd1')!
    expect(dept.labor_cost).toBeCloseTo(334.17, 2)
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
    const p2 = report.casual.postings.find(p => p.posting_id === 'p2')!
    expect(p2.days_to_fill).toBeNull() // no openings defined → never "filled"
  })

  it('returns null rates (not fake 0%) when a period has nothing to measure', async () => {
    const report = await reportService.getCompanyReport(FILTERS)
    expect(report.previous_overview.attendance_rate).toBeNull()
    expect(report.previous_overview.on_time_completion_rate).toBeNull()
    expect(report.previous_overview.recruitment_fill_rate).toBeNull()
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
