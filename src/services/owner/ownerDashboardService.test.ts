import { describe, it, expect, vi, beforeEach } from 'vitest'

// Wednesday noon UTC — keeps local/UTC calendar date identical regardless of runner timezone,
// same convention as attendanceService.test.ts.
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-07-16T12:00:00.000Z'))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/owner/attendanceService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/owner/attendanceService')>()
  return {
    ...actual,
    attendanceService: {
      getShiftSwapRequests: vi.fn(),
      getAttendanceByDateRange: vi.fn(),
    },
  }
})

vi.mock('@/services/owner/offDaySettingsService', () => ({
  offDaySettingsService: { getDeadline: vi.fn() },
}))

vi.mock('@/services/owner/taskService', () => ({
  taskService: { getKanbanTasks: vi.fn(), getTaskDelayAlerts: vi.fn() },
}))

vi.mock('@/services/owner/recruitmentService', () => ({
  recruitmentService: { getJobPostings: vi.fn(), getPendingApprovalPostings: vi.fn(), getApplicants: vi.fn() },
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: { getOffDayRequestsByCompanyAndWeek: vi.fn(), getUsersByIds: vi.fn() },
}))

vi.mock('@/services/owner/ownerTeamService', () => ({
  ownerTeamService: { getManagerDepartments: vi.fn() },
}))

import { ownerDashboardService } from './ownerDashboardService'
import { attendanceService } from '@/services/owner/attendanceService'
import { offDaySettingsService } from '@/services/owner/offDaySettingsService'
import { taskService } from '@/services/owner/taskService'
import { recruitmentService } from '@/services/owner/recruitmentService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { ownerTeamService } from '@/services/owner/ownerTeamService'

const emptyKanban = { Assigned: [], 'In Progress': [], Review: [], Complete: [] }

function setDefaults() {
  vi.mocked(attendanceService.getShiftSwapRequests).mockResolvedValue([])
  vi.mocked(attendanceService.getAttendanceByDateRange).mockResolvedValue([])
  vi.mocked(offDaySettingsService.getDeadline).mockResolvedValue(null)
  vi.mocked(taskService.getKanbanTasks).mockResolvedValue(emptyKanban as any)
  vi.mocked(taskService.getTaskDelayAlerts).mockResolvedValue([])
  vi.mocked(recruitmentService.getJobPostings).mockResolvedValue([])
  vi.mocked(recruitmentService.getPendingApprovalPostings).mockResolvedValue([])
  vi.mocked(recruitmentService.getApplicants).mockResolvedValue([])
  vi.mocked(attendanceRepository.getOffDayRequestsByCompanyAndWeek).mockResolvedValue([])
  vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([])
}

describe('ownerDashboardService.getDashboardSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaults()
  })

  it('throws when company_id or owner_id is missing', async () => {
    await expect(ownerDashboardService.getDashboardSummary('', 'owner-1')).rejects.toThrow('company_id is required')
    await expect(ownerDashboardService.getDashboardSummary('company-1', '')).rejects.toThrow('owner_id is required')
  })

  describe('Waiting On You', () => {
    it('keeps the 5 fixed-priority categories in order when all are pending', async () => {
      vi.mocked(attendanceService.getShiftSwapRequests).mockResolvedValue([
        { status: 'pending', requires_owner_review: true, created_at: '2026-07-16T01:00:00Z' } as any,
      ])
      vi.mocked(taskService.getKanbanTasks).mockResolvedValue({
        ...emptyKanban,
        Review: [{ id: 't1', title: 'Review me', created_at: '2026-07-16T02:00:00Z' } as any],
      } as any)
      vi.mocked(recruitmentService.getPendingApprovalPostings).mockResolvedValue([
        { id: 'p1', created_at: '2026-07-16T03:00:00Z' } as any,
      ])
      vi.mocked(recruitmentService.getJobPostings).mockResolvedValue([
        { id: 'p2', pending_count: 1 } as any,
      ])
      vi.mocked(recruitmentService.getApplicants).mockResolvedValue([
        { job_id: 'p2', status: 'pending', applied_at: '2026-07-15T00:00:00Z' } as any,
      ])

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      expect(result.waiting_on_you.slice(0, -1).map(i => i.id)).toEqual([
        'shift_swap', 'job_posting_approval', 'applicant_accept', 'task_review',
      ])
      // off_day_deadline had no configured deadline, so it stays cleared and sinks to the bottom.
      expect(result.waiting_on_you.at(-1)?.id).toBe('off_day_deadline')
      expect(result.waiting_on_you.at(-1)?.count).toBe(0)
    })

    it('demotes cleared categories below pending ones instead of leaving them in their fixed slot', async () => {
      // Only "Review Tasks" (priority slot 5) has pending items — everything else is clear.
      vi.mocked(taskService.getKanbanTasks).mockResolvedValue({
        ...emptyKanban,
        Review: [{ id: 't1', title: 'Review me', created_at: '2026-07-16T02:00:00Z' } as any],
      } as any)

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      expect(result.waiting_on_you[0].id).toBe('task_review')
      expect(result.waiting_on_you[0].count).toBe(1)
      expect(result.waiting_on_you.slice(1).every(i => i.count === 0)).toBe(true)
    })

    it('only fires the off-day deadline item when the most recently closed week still has pending requests', async () => {
      vi.mocked(offDaySettingsService.getDeadline).mockResolvedValue({
        company_id: 'company-1', deadline_weekday: 1, deadline_time: '09:00', updated_by: null, updated_at: '',
      })
      vi.mocked(attendanceRepository.getOffDayRequestsByCompanyAndWeek).mockResolvedValue([
        { id: 'r1', status: 'pending' } as any,
        { id: 'r2', status: 'approved' } as any,
      ])

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      const offDay = result.waiting_on_you.find(i => i.id === 'off_day_deadline')!
      expect(offDay.count).toBe(1)
      expect(offDay.detail).toMatch(/^for /)
    })
  })

  describe('Task Overview', () => {
    it('excludes a task from Delay Alert if it is already counted as Overdue', async () => {
      vi.mocked(taskService.getKanbanTasks).mockResolvedValue({
        ...emptyKanban,
        Assigned: [{ id: 't1', title: 'Stalled + overdue', due_at: '2026-07-15T00:00:00Z', assigned_user_id: 'u1' } as any],
      } as any)
      vi.mocked(taskService.getTaskDelayAlerts).mockResolvedValue([
        { task_id: 't1', title: 'Stalled + overdue', status: 'Assigned', percent_elapsed: 140, message: '' },
      ])
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'u1', full_name: 'Alice', role: 'Manager' } as any])

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      const overdue = result.task_overview.find(g => g.key === 'overdue')!
      const delayAlert = result.task_overview.find(g => g.key === 'delay_alert')!
      expect(overdue.tasks.map(t => t.id)).toEqual(['t1'])
      expect(overdue.tasks[0].assignee_name).toBe('Alice')
      expect(delayAlert.tasks).toEqual([])
    })

    it('buckets a not-yet-overdue delay-alerted task under Delay Alert', async () => {
      vi.mocked(taskService.getKanbanTasks).mockResolvedValue({
        ...emptyKanban,
        Assigned: [{ id: 't2', title: 'Not started', due_at: '2026-07-16T23:00:00Z', assigned_user_id: 'u1' } as any],
      } as any)
      vi.mocked(taskService.getTaskDelayAlerts).mockResolvedValue([
        { task_id: 't2', title: 'Not started', status: 'Assigned', percent_elapsed: 60, message: '' },
      ])
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'u1', full_name: 'Bob', role: 'Employee' } as any])

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      expect(result.task_overview.find(g => g.key === 'delay_alert')!.tasks.map(t => t.id)).toEqual(['t2'])
      expect(result.task_overview.find(g => g.key === 'overdue')!.tasks).toEqual([])
    })

    it('counts a Complete task as Completed only if it finished today', async () => {
      vi.mocked(taskService.getKanbanTasks).mockResolvedValue({
        ...emptyKanban,
        Complete: [
          { id: 't3', title: 'Done today', completed_at: '2026-07-16T09:00:00Z', assigned_user_id: null } as any,
          { id: 't4', title: 'Done yesterday', completed_at: '2026-07-15T09:00:00Z', assigned_user_id: null } as any,
        ],
      } as any)

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      expect(result.task_overview.find(g => g.key === 'completed')!.tasks.map(t => t.id)).toEqual(['t3'])
    })
  })

  describe('Attendance Overview', () => {
    const shift = { shift_date: '2026-07-16', start_time: '09:00', end_time: '17:00' }

    it('splits Internal Staff and Casual Workers into independent groups with per-department counts', async () => {
      vi.mocked(attendanceService.getAttendanceByDateRange).mockResolvedValue([
        { assignment: { user_id: 'm1' }, shift, assignee_name: 'Manager Lim', assignee_role: 'Manager', department_name: 'Kitchen', record: { clock_in_time: '2026-07-16T09:00:00Z' }, exceptions: [] } as any,
        { assignment: { user_id: 'cw1' }, shift, assignee_name: 'Aina', assignee_role: 'Casual Worker', department_name: 'Service', record: null, exceptions: [] } as any,
      ])

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      const internal = result.attendance_overview.internal
      const casual = result.attendance_overview.casual
      expect(internal.expected).toBe(1)
      expect(internal.checked_in).toBe(1)
      expect(internal.departments.map(d => d.department_name)).toEqual(['Kitchen'])
      expect(internal.departments[0].checked_in).toBe(1)
      expect(casual.expected).toBe(1)
      expect(casual.checked_in).toBe(0)
      expect(casual.departments[0].not_started.map(p => p.name)).toEqual(['Aina'])
    })

    it('classifies Late (with clock-in label + minutes), Absent, and Present (with clock-in label)', async () => {
      vi.mocked(attendanceService.getAttendanceByDateRange).mockResolvedValue([
        { assignment: { user_id: 'm1' }, shift, assignee_name: 'Late Manager', assignee_role: 'Manager', department_name: null, record: { clock_in_time: '2026-07-16T09:20:00Z' }, exceptions: ['late'] } as any,
        { assignment: { user_id: 'm2' }, shift, assignee_name: 'Absent Manager', assignee_role: 'Manager', department_name: null, record: null, exceptions: ['absent'] } as any,
        { assignment: { user_id: 'm3' }, shift, assignee_name: 'Present Manager', assignee_role: 'Manager', department_name: null, record: { clock_in_time: '2026-07-16T09:00:00Z' }, exceptions: [] } as any,
      ])

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      const internal = result.attendance_overview.internal
      expect(internal.departments.map(d => d.department_name)).toEqual(['General'])
      const dept = internal.departments[0]
      expect(dept.late.map(r => r.name)).toEqual(['Late Manager'])
      expect(dept.late[0].minutes_late).toBe(20)
      expect(dept.late[0].clock_in_label).toMatch(/09:20/)
      expect(dept.absent.map(r => r.name)).toEqual(['Absent Manager'])
      // Present Manager is listed in the present bucket (feeds the legend hover popover).
      expect(dept.present.map(r => r.name)).toEqual(['Present Manager'])
      expect(dept.present[0].clock_in_label).toMatch(/09:00/)
      expect([...dept.late, ...dept.absent, ...dept.not_started].some(r => r.name === 'Present Manager')).toBe(false)
    })

    it('groups Not Started rows by shift start time within the department', async () => {
      vi.mocked(attendanceService.getAttendanceByDateRange).mockResolvedValue([
        { assignment: { user_id: 'cw1' }, shift: { shift_date: '2026-07-16', start_time: '18:00', end_time: '22:00' }, assignee_name: 'Kai Yang', assignee_role: 'Casual Worker', department_name: 'Kitchen', record: null, exceptions: [] } as any,
        { assignment: { user_id: 'cw2' }, shift: { shift_date: '2026-07-16', start_time: '11:00', end_time: '15:00' }, assignee_name: 'Mei Lin', assignee_role: 'Casual Worker', department_name: 'Kitchen', record: null, exceptions: [] } as any,
      ])

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      const dept = result.attendance_overview.casual.departments[0]
      expect(dept.department_name).toBe('Kitchen')
      expect(dept.not_started.map(p => `${p.shift_start} ${p.name}`)).toEqual(['11:00 Mei Lin', '18:00 Kai Yang'])
    })
  })

  describe('Recruitment Overview', () => {
    it('lists open postings whose application deadline is today', async () => {
      vi.mocked(recruitmentService.getJobPostings).mockResolvedValue([
        { id: 'p1', title: 'Cleaner', status: 'open', expires_at: '2026-07-16T12:00:00Z', shift_date: null, openings: 3, confirmed_count: 1, pending_count: 0 } as any,
        { id: 'p2', title: 'Barista', status: 'open', expires_at: '2026-07-20T23:59:00Z', shift_date: null, openings: 2, confirmed_count: 0, pending_count: 0 } as any,
      ])

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      expect(result.recruitment_overview.deadline_today.map(r => r.job_id)).toEqual(['p1'])
    })

    it('lists postings starting within 2 days only when understaffed, and excludes fully-staffed ones', async () => {
      vi.mocked(recruitmentService.getJobPostings).mockResolvedValue([
        { id: 'p1', title: 'Server understaffed', status: 'open', expires_at: null, shift_date: '2026-07-17', openings: 2, confirmed_count: 0, pending_count: 0 } as any,
        { id: 'p2', title: 'Fully staffed', status: 'open', expires_at: null, shift_date: '2026-07-17', openings: 2, confirmed_count: 2, pending_count: 0 } as any,
        { id: 'p3', title: 'Too far out', status: 'open', expires_at: null, shift_date: '2026-07-25', openings: 1, confirmed_count: 0, pending_count: 0 } as any,
      ])

      const result = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

      expect(result.recruitment_overview.starting_soon.map(r => r.job_id)).toEqual(['p1'])
    })
  })
})

describe('Manager viewer scope (role scope: own departments only)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaults()
    vi.mocked(ownerTeamService.getManagerDepartments).mockResolvedValue([
      { department_id: 'dept-1', department_name: 'Kitchen' },
    ])
  })

  it('filters swap requests to the manager departments and drops the job-approval card', async () => {
    vi.mocked(attendanceService.getShiftSwapRequests).mockResolvedValue([
      { status: 'pending', created_at: '2026-07-15T00:00:00Z', department_name: 'Kitchen' },
      { status: 'pending', created_at: '2026-07-15T00:00:00Z', department_name: 'Front Desk' },
    ] as never)
    vi.mocked(recruitmentService.getPendingApprovalPostings).mockResolvedValue([
      { id: 'p1', created_at: '2026-07-15T00:00:00Z' },
    ] as never)

    const summary = await ownerDashboardService.getDashboardSummary('company-1', 'manager-1', 'Manager')

    const swapItem = summary.waiting_on_you.find(i => i.id === 'shift_swap')
    expect(swapItem?.count).toBe(1)
    expect(summary.waiting_on_you.some(i => i.id === 'job_posting_approval')).toBe(false)
    expect(ownerTeamService.getManagerDepartments).toHaveBeenCalledWith('manager-1', 'company-1')
  })

  it('filters attendance overview and recruitment overview to the manager departments', async () => {
    vi.mocked(attendanceService.getAttendanceByDateRange).mockResolvedValue([
      { assignee_role: 'Employee', assignee_name: 'A', department_name: 'Kitchen', shift: { department_id: 'dept-1', shift_date: '2026-07-16', start_time: '09:00:00' }, assignment: { user_id: 'u1' }, record: null, exceptions: [] },
      { assignee_role: 'Employee', assignee_name: 'B', department_name: 'Front Desk', shift: { department_id: 'dept-2', shift_date: '2026-07-16', start_time: '09:00:00' }, assignment: { user_id: 'u2' }, record: null, exceptions: [] },
    ] as never)
    vi.mocked(recruitmentService.getJobPostings).mockResolvedValue([
      { id: 'j1', status: 'open', department_id: 'dept-1', title: 'K', confirmed_count: 0, openings: 1, pending_count: 0, expires_at: '2026-07-16T10:00:00Z', shift_date: null },
      { id: 'j2', status: 'open', department_id: 'dept-2', title: 'F', confirmed_count: 0, openings: 1, pending_count: 0, expires_at: '2026-07-16T10:00:00Z', shift_date: null },
    ] as never)

    const summary = await ownerDashboardService.getDashboardSummary('company-1', 'manager-1', 'Manager')

    expect(summary.attendance_overview.internal.expected).toBe(1)
    expect(summary.attendance_overview.internal.departments.map(d => d.department_name)).toEqual(['Kitchen'])
    expect(summary.recruitment_overview.deadline_today.map(r => r.job_id)).toEqual(['j1'])
  })

  it('an Owner viewer (no viewer_role) still sees everything, unscoped', async () => {
    vi.mocked(attendanceService.getShiftSwapRequests).mockResolvedValue([
      { status: 'pending', created_at: '2026-07-15T00:00:00Z', department_name: 'Kitchen' },
      { status: 'pending', created_at: '2026-07-15T00:00:00Z', department_name: 'Front Desk' },
    ] as never)

    const summary = await ownerDashboardService.getDashboardSummary('company-1', 'owner-1')

    expect(summary.waiting_on_you.find(i => i.id === 'shift_swap')?.count).toBe(2)
    expect(summary.waiting_on_you.some(i => i.id === 'job_posting_approval')).toBe(true)
    expect(ownerTeamService.getManagerDepartments).not.toHaveBeenCalled()
  })
})
