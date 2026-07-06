import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getAssignmentsByCompany: vi.fn(),
    getAssignmentsByCompanyAndDateRange: vi.fn(),
    getAttendanceRecordsByAssignmentIds: vi.fn(),
    getAttendanceRecordById: vi.fn(),
    updateAttendanceRecord: vi.fn(),
    getUsersByIds: vi.fn(),
    getDepartmentsByIds: vi.fn(),
    getShiftSwapRequestsByCompany: vi.fn(),
    getShiftSwapRequestById: vi.fn(),
    updateShiftSwapRequest: vi.fn(),
    updateShiftAssignmentUser: vi.fn(),
    getShiftAssignmentById: vi.fn(),
    getShiftAssignmentsByIds: vi.fn(),
    getPendingSwapRequestsByAssignment: vi.fn(),
    createShiftSwapRequest: vi.fn(),
    getTasksByShiftAssignment: vi.fn(),
    getMovableTasksByShiftAssignment: vi.fn(),
    getTasksByShiftIds: vi.fn(),
    getMovableTasksByShiftIds: vi.fn(),
    getOffDayRequestsByCompany: vi.fn(),
    getFixedOffDayRequestById: vi.fn(),
    getFixedOffDayRequestsByIds: vi.fn(),
    updateFixedOffDayRequest: vi.fn(),
    createFixedOffDayRequests: vi.fn(),
    deleteFixedOffDayRequestsByUserAndWeek: vi.fn(),
    getFixedOffDayRequestsByUser: vi.fn(),
    getFixedOffDayRequestsByUserAndWeek: vi.fn(),
    getOffDayRequestsByCompanyAndWeek: vi.fn(),
    getEmployeeIdsByDepartments: vi.fn(),
    getEmployeesByCompany: vi.fn(),
    getManagersByCompany: vi.fn(),
    getScheduledHeadcountForDeptDate: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/offDaySettingsRepository', () => ({
  offDaySettingsRepository: {
    getQuotaForUser: vi.fn(),
    getCompanyDefaultQuota: vi.fn(),
    getDeadline: vi.fn(),
  },
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByAuthIdOrInternalId: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    reassignTasksForShiftSwap: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/ownerTeamRepository', () => ({
  ownerTeamRepository: {
    findManagerDepartments: vi.fn(),
  },
}))

import { attendanceService } from './attendanceService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { offDaySettingsRepository } from '@/repositories/owner/offDaySettingsRepository'
import { taskRepository } from '@/repositories/owner/taskRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { authRepository } from '@/repositories/auth/authRepository'
import { weekStart } from '@/lib/schedulingConstants'

const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const dayAfterStr = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const todayStr = new Date().toISOString().slice(0, 10)

describe('attendanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('finalReviewAttendance (UC50: Review Attendance Record)', () => {
    it('approves a record and stamps the reviewer/timestamp', async () => {
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({
        id: 'rec-1', clock_in_time: '09:00', clock_out_time: '17:00',
        owner_adjusted_clock_in_time: null, owner_adjusted_clock_out_time: null,
      } as any)
      vi.mocked(attendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'rec-1' } as any)

      await attendanceService.finalReviewAttendance({ id: 'rec-1', owner_id: 'owner-1', decision: 'approved' })

      expect(attendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('rec-1', expect.objectContaining({
        owner_status: 'approved',
        owner_reviewed_by: 'owner-1',
        status: 'owner_approved',
      }))
    })

    it('rejects an invalid decision value before touching the repository', async () => {
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue({ id: 'rec-1' } as any)

      await expect(attendanceService.finalReviewAttendance({ id: 'rec-1', owner_id: 'owner-1', decision: 'bogus' as any }))
        .rejects.toThrow('Invalid attendance decision')
      expect(attendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
    })

    it('throws when the record does not exist', async () => {
      vi.mocked(attendanceRepository.getAttendanceRecordById).mockResolvedValue(null)

      await expect(attendanceService.finalReviewAttendance({ id: 'missing', owner_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('Attendance record not found')
    })
  })

  describe('getAttendanceDashboard (UC51: View Attendance Status)', () => {
    it('computes summary counts from real queried rows, not invented numbers', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompany).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'rec-1', shift_assignment_id: 'asn-1', casual_worker_id: 'user-1', confirmed_by_employee_id: 'user-1', submitted_by_employee_id: 'user-1', clock_in_time: '2026-01-01T09:00:00Z', clock_out_time: '2026-01-01T17:00:00Z', owner_status: 'approved' },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const dashboard = await attendanceService.getAttendanceDashboard('company-1')

      expect(dashboard.records).toHaveLength(1)
      expect(dashboard.summary.total_assignments).toBe(1)
      expect(dashboard.summary.approved).toBe(1)
      expect(dashboard.summary.pending_final_review).toBe(0)
    })

    it('does not flag a clock-in inside the 10-minute grace period as late (UC49)', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompany).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'rec-1', shift_assignment_id: 'asn-1', casual_worker_id: 'user-1', confirmed_by_employee_id: 'user-1', submitted_by_employee_id: 'user-1', clock_in_time: '2026-01-01T09:10:00Z', clock_out_time: null, owner_status: 'pending' },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const dashboard = await attendanceService.getAttendanceDashboard('company-1')

      expect(dashboard.records[0].exceptions).not.toContain('late')
    })

    it('flags a clock-in past the 10-minute grace period as late (UC49)', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompany).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'rec-1', shift_assignment_id: 'asn-1', casual_worker_id: 'user-1', confirmed_by_employee_id: 'user-1', submitted_by_employee_id: 'user-1', clock_in_time: '2026-01-01T09:11:00Z', clock_out_time: null, owner_status: 'pending' },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const dashboard = await attendanceService.getAttendanceDashboard('company-1')

      expect(dashboard.records[0].exceptions).toContain('late')
    })
  })

  describe('getAttendanceByDateRange (UC50: Review Attendance Record, UC51: View Attendance Status)', () => {
    it('queries assignments scoped to the given date window, not the whole company history', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompanyAndDateRange).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-06-29', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const records = await attendanceService.getAttendanceByDateRange('company-1', '2026-06-29', '2026-06-29')

      expect(attendanceRepository.getAssignmentsByCompanyAndDateRange).toHaveBeenCalledWith('company-1', '2026-06-29', '2026-06-29')
      expect(attendanceRepository.getAssignmentsByCompany).not.toHaveBeenCalled()
      expect(records).toHaveLength(1)
      expect(records[0].assignee_name).toBe('Alice')
    })

    it('returns an empty array when there are no assignments in the window', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompanyAndDateRange).mockResolvedValue([])
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const records = await attendanceService.getAttendanceByDateRange('company-1', '2026-06-01', '2026-06-30')

      expect(records).toEqual([])
    })

    it('still computes exceptions (e.g. absent) per record the same way the dashboard does', async () => {
      vi.mocked(attendanceRepository.getAssignmentsByCompanyAndDateRange).mockResolvedValue([
        {
          id: 'asn-1', user_id: 'user-1', supervisor_employee_id: null,
          shifts: { id: 'shift-1', department_id: null, shift_date: '2026-01-01', start_time: '09:00', end_time: '17:00', title: 'Shift' },
        },
      ] as any)
      vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Alice', role: 'Employee' }] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([])

      const records = await attendanceService.getAttendanceByDateRange('company-1', '2026-01-01', '2026-01-01')

      // No record + shift already in the past (relative to "now" the test runs) => absent.
      expect(records[0].exceptions).toContain('absent')
    })
  })

  describe('decideShiftSwapRequest (UC53: Approve Shift Swap Request)', () => {
    const futureAssignment = (id: string, user_id: string, shift_id: string, shift_date: string) => ({
      id, user_id, shift_id,
      shifts: { id: shift_id, department_id: 'dept-1', shift_date, start_time: '09:00', end_time: '17:00', title: 'Shift' },
    })

    it('swaps both assignment users and reassigns each party\'s active tasks on approval', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue({
        id: 'swap-1',
        requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2',
        counterpart_status: 'approved', status: 'pending',
      } as any)
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return futureAssignment('asn-1', 'user-1', 'shift-1', tomorrowStr) as any
        if (id === 'asn-2') return futureAssignment('asn-2', 'user-2', 'shift-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.updateShiftAssignmentUser).mockResolvedValue({} as any)
      vi.mocked(taskRepository.reassignTasksForShiftSwap).mockResolvedValue(undefined)
      vi.mocked(attendanceRepository.updateShiftSwapRequest).mockResolvedValue({ id: 'swap-1', status: 'approved' } as any)

      await attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'approved' })

      expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('asn-1', 'user-2')
      expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('asn-2', 'user-1')
      expect(taskRepository.reassignTasksForShiftSwap).toHaveBeenCalledWith('shift-1', 'user-1', 'user-2')
      expect(taskRepository.reassignTasksForShiftSwap).toHaveBeenCalledWith('shift-2', 'user-2', 'user-1')
      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenCalledWith('swap-1', expect.objectContaining({ status: 'approved', reviewed_by: 'owner-1' }))
    })

    it('does not reassign shifts or tasks on rejection', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue({
        id: 'swap-1',
        requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2',
        counterpart_status: 'approved', status: 'pending',
      } as any)
      vi.mocked(attendanceRepository.updateShiftSwapRequest).mockResolvedValue({ id: 'swap-1', status: 'rejected' } as any)

      await attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'rejected' })

      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
      expect(taskRepository.reassignTasksForShiftSwap).not.toHaveBeenCalled()
    })

    it('throws if counterpart has not agreed', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue({
        id: 'swap-1',
        counterpart_status: 'pending', status: 'pending',
      } as any)

      await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('Counterpart has not agreed yet')
    })

    it('auto-rejects and blocks approval if a shift has become today by decision time', async () => {
      // A pending request that sat unreviewed long enough for one of its two shift dates to
      // arrive can no longer be approved — it must be closed out as 'rejected' automatically
      // instead of erroring out while remaining stuck in the pending queue forever.
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue({
        id: 'swap-1',
        requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2',
        counterpart_status: 'approved', status: 'pending',
      } as any)
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        // Requester's shift has aged into "today" since the request was submitted
        if (id === 'asn-1') return futureAssignment('asn-1', 'user-1', 'shift-1', todayStr) as any
        if (id === 'asn-2') return futureAssignment('asn-2', 'user-2', 'shift-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.updateShiftSwapRequest).mockResolvedValue({ id: 'swap-1', status: 'rejected' } as any)

      await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('Request is no longer pending')

      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenCalledWith('swap-1', expect.objectContaining({ status: 'rejected' }))
      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
      expect(taskRepository.reassignTasksForShiftSwap).not.toHaveBeenCalled()
    })
  })

  describe('submitShiftSwapRequest (UC52: Submit Shift Swap Request)', () => {
    const baseAssignment = (id: string, user_id: string, shift_date: string) => ({
      id, user_id,
      shifts: { id: `shift-${id}`, department_id: 'dept-1', shift_date, start_time: '09:00', end_time: '17:00', title: 'Shift' },
    })
    const sameRoleUsers = [
      { id: 'user-1', full_name: 'Alice', role: 'Employee' },
      { id: 'user-2', full_name: 'Bob', role: 'Employee' },
    ]

    it('rejects a self-swap before touching assignment data', async () => {
      await expect(attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-1', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('Cannot swap shifts with yourself')
      expect(attendanceRepository.getShiftAssignmentById).not.toHaveBeenCalled()
    })

    it('rejects when the requester\'s own shift is today', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return baseAssignment('asn-1', 'user-1', todayStr) as any
        if (id === 'asn-2') return baseAssignment('asn-2', 'user-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue(sameRoleUsers as any)

      await expect(attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('tomorrow or later')
      expect(attendanceRepository.createShiftSwapRequest).not.toHaveBeenCalled()
    })

    it('rejects when the counterpart\'s shift is in the past', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return baseAssignment('asn-1', 'user-1', dayAfterStr) as any
        if (id === 'asn-2') return baseAssignment('asn-2', 'user-2', '2020-01-01') as any
        return null
      })
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue(sameRoleUsers as any)

      await expect(attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('tomorrow or later')
      expect(attendanceRepository.createShiftSwapRequest).not.toHaveBeenCalled()
    })

    it('rejects when the two shifts belong to different departments', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return { id: 'asn-1', user_id: 'user-1', shifts: { id: 'shift-1', department_id: 'dept-1', shift_date: tomorrowStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } } as any
        if (id === 'asn-2') return { id: 'asn-2', user_id: 'user-2', shifts: { id: 'shift-2', department_id: 'dept-2', shift_date: dayAfterStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } } as any
        return null
      })

      await expect(attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('same department')
      expect(attendanceRepository.getUsersByIds).not.toHaveBeenCalled()
      expect(attendanceRepository.createShiftSwapRequest).not.toHaveBeenCalled()
    })

    it('rejects when the requester and counterpart have different roles (e.g. Manager vs Employee)', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return baseAssignment('asn-1', 'user-1', tomorrowStr) as any
        if (id === 'asn-2') return baseAssignment('asn-2', 'user-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'user-1', full_name: 'Alice', role: 'Manager' },
        { id: 'user-2', full_name: 'Bob', role: 'Employee' },
      ] as any)

      await expect(attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })).rejects.toThrow('same role')
      expect(attendanceRepository.createShiftSwapRequest).not.toHaveBeenCalled()
    })

    it('accepts shifts scheduled tomorrow or later', async () => {
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return baseAssignment('asn-1', 'user-1', tomorrowStr) as any
        if (id === 'asn-2') return baseAssignment('asn-2', 'user-2', dayAfterStr) as any
        return null
      })
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue(sameRoleUsers as any)
      vi.mocked(attendanceRepository.getPendingSwapRequestsByAssignment).mockResolvedValue([])
      vi.mocked(attendanceRepository.createShiftSwapRequest).mockResolvedValue({ id: 'swap-1' } as any)

      await attendanceService.submitShiftSwapRequest({
        company_id: 'company-1', requester_id: 'user-1', requester_assignment_id: 'asn-1',
        counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2', reason: null,
      })

      expect(attendanceRepository.createShiftSwapRequest).toHaveBeenCalled()
    })
  })

  describe('getShiftSwapRequests (task-impact preview)', () => {
    it('attaches each side\'s movable tasks from getMovableTasksByShiftAssignment', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestsByCompany).mockResolvedValue([
        {
          id: 'swap-1', company_id: 'company-1',
          requester_id: 'user-1', requester_assignment_id: 'asn-1',
          counterpart_id: 'user-2', counterpart_assignment_id: 'asn-2',
          counterpart_status: 'approved', status: 'pending',
        } as any,
      ])
      vi.mocked(attendanceRepository.getShiftAssignmentsByIds).mockResolvedValue([
        { id: 'asn-1', user_id: 'user-1', shift_id: 'shift-1', shifts: { department_id: 'dept-1', shift_date: tomorrowStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
        { id: 'asn-2', user_id: 'user-2', shift_id: 'shift-2', shifts: { department_id: 'dept-1', shift_date: dayAfterStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'user-1', full_name: 'Alice', role: 'Manager' },
        { id: 'user-2', full_name: 'Bob', role: 'Manager' },
      ] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([{ id: 'dept-1', name: 'Ops' }] as any)
      vi.mocked(attendanceRepository.getTasksByShiftIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getMovableTasksByShiftIds).mockResolvedValue([
        { id: 'task-1', title: 'Restock shelves', description: null, status: 'Assigned', priority: 'Medium', due_at: '2026-07-03T17:00:00Z', created_at: '2026-07-01T09:00:00Z', shift_id: 'shift-1', assigned_user_id: 'user-1' },
        { id: 'task-2', title: 'Close register', description: null, status: 'In Progress', priority: 'Low', due_at: null, created_at: '2026-07-01T09:00:00Z', shift_id: 'shift-2', assigned_user_id: 'user-2' },
      ] as any)

      const requests = await attendanceService.getShiftSwapRequests('company-1')

      expect(requests[0].requester_movable_tasks).toEqual([{ id: 'task-1', title: 'Restock shelves', description: null, status: 'Assigned', priority: 'Medium', due_at: '2026-07-03T17:00:00Z', created_at: '2026-07-01T09:00:00Z' }])
      expect(requests[0].counterpart_movable_tasks).toEqual([{ id: 'task-2', title: 'Close register', description: null, status: 'In Progress', priority: 'Low', due_at: null, created_at: '2026-07-01T09:00:00Z' }])
    })
  })

  describe('getShiftSwapRequests (Owner vs Manager queue split)', () => {
    const twoSwaps = [
      {
        id: 'swap-mgr', company_id: 'company-1',
        requester_id: 'mgr-1', requester_assignment_id: 'asn-mgr-1',
        counterpart_id: 'mgr-2', counterpart_assignment_id: 'asn-mgr-2',
        counterpart_status: 'approved', status: 'pending',
      },
      {
        id: 'swap-emp', company_id: 'company-1',
        requester_id: 'emp-1', requester_assignment_id: 'asn-emp-1',
        counterpart_id: 'emp-2', counterpart_assignment_id: 'asn-emp-2',
        counterpart_status: 'approved', status: 'pending',
      },
    ]

    beforeEach(() => {
      vi.mocked(attendanceRepository.getShiftSwapRequestsByCompany).mockResolvedValue(twoSwaps as any)
      vi.mocked(attendanceRepository.getShiftAssignmentsByIds).mockResolvedValue([
        { id: 'asn-mgr-1', user_id: 'mgr-1', shift_id: 'shift-mgr-1', shifts: { department_id: 'dept-ops', shift_date: tomorrowStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
        { id: 'asn-mgr-2', user_id: 'mgr-2', shift_id: 'shift-mgr-2', shifts: { department_id: 'dept-ops', shift_date: dayAfterStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
        { id: 'asn-emp-1', user_id: 'emp-1', shift_id: 'shift-emp-1', shifts: { department_id: 'dept-ops', shift_date: tomorrowStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
        { id: 'asn-emp-2', user_id: 'emp-2', shift_id: 'shift-emp-2', shifts: { department_id: 'dept-ops', shift_date: dayAfterStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'mgr-1', full_name: 'Manager One', role: 'Manager' },
        { id: 'mgr-2', full_name: 'Manager Two', role: 'Manager' },
        { id: 'emp-1', full_name: 'Employee One', role: 'Employee' },
        { id: 'emp-2', full_name: 'Employee Two', role: 'Employee' },
      ] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([{ id: 'dept-ops', name: 'Ops' }] as any)
      vi.mocked(attendanceRepository.getTasksByShiftIds).mockResolvedValue([])
      vi.mocked(attendanceRepository.getMovableTasksByShiftIds).mockResolvedValue([])
    })

    it('Owner queue (no managerId) only returns the Manager<->Manager swap', async () => {
      const requests = await attendanceService.getShiftSwapRequests('company-1')

      expect(requests.map(r => r.id)).toEqual(['swap-mgr'])
      expect(ownerTeamRepository.findManagerDepartments).not.toHaveBeenCalled()
    })

    it('Manager queue only returns the Employee<->Employee swap within a department they manage', async () => {
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-ops', department_name: 'Ops' }])

      const requests = await attendanceService.getShiftSwapRequests('company-1', { managerId: 'mgr-1' })

      expect(requests.map(r => r.id)).toEqual(['swap-emp'])
    })

    it('Manager queue excludes an Employee<->Employee swap outside their managed departments', async () => {
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-other', department_name: 'Other' }])

      const requests = await attendanceService.getShiftSwapRequests('company-1', { managerId: 'mgr-1' })

      expect(requests).toEqual([])
    })
  })

  describe('decideFixedOffDayRequest (UC56: Approve Fixed Day Off)', () => {
    it('approves a pending fixed day off request', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-10', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
      } as any)
      vi.mocked(attendanceRepository.updateFixedOffDayRequest).mockResolvedValue({ id: 'fod-1', status: 'approved' } as any)

      await attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'approved' })

      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-1', expect.objectContaining({ status: 'approved', reviewed_by: 'owner-1' }))
    })

    it('rejects an invalid decision value', async () => {
      await expect(attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'bogus' as any }))
        .rejects.toThrow('Invalid request decision')
      expect(attendanceRepository.getFixedOffDayRequestById).not.toHaveBeenCalled()
    })

    it('throws when the request does not exist', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue(null)

      await expect(attendanceService.decideFixedOffDayRequest({ id: 'missing', reviewer_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('Weekly day off request not found')
    })

    it('throws when trying to decide an already-approved auto-assigned row', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-auto', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-10', week_start: '2026-07-06', status: 'approved', source: 'auto_assigned', reviewed_by: null, reviewed_at: '2026-01-01', created_at: '2026-01-01',
      } as any)

      await expect(attendanceService.decideFixedOffDayRequest({ id: 'fod-auto', reviewer_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('auto-assigned')
      expect(attendanceRepository.updateFixedOffDayRequest).not.toHaveBeenCalled()
    })

    it('modifies the request to a replacement date within the same week', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-09', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
      } as any)
      vi.mocked(attendanceRepository.updateFixedOffDayRequest).mockResolvedValue({ id: 'fod-1', status: 'modified' } as any)

      await attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'modified', new_date: '2026-07-11' })

      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-1', expect.objectContaining({ status: 'modified', reviewed_by: 'owner-1', request_date: '2026-07-11' }))
    })

    it('rejects a modify with no new_date', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-09', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
      } as any)

      await expect(attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'modified' }))
        .rejects.toThrow('new_date is required')
    })

    it('rejects a modify whose new_date falls in a different week', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', request_date: '2026-07-09', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
      } as any)

      await expect(attendanceService.decideFixedOffDayRequest({ id: 'fod-1', reviewer_id: 'owner-1', decision: 'modified', new_date: '2026-07-14' }))
        .rejects.toThrow('same week')
    })
  })

  describe('decideFixedOffDayRequestGroup (batch approve/reject a weekly submission)', () => {
    const rowFor = (id: string, date: string) => ({
      id, user_id: 'user-1', company_id: 'company-1', request_date: date, week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
    })

    it('approves every id in the group with the same reviewer and timestamp', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)
      vi.mocked(attendanceRepository.updateFixedOffDayRequest).mockResolvedValue({} as any)

      await attendanceService.decideFixedOffDayRequestGroup({ ids: ['fod-1', 'fod-2'], reviewer_id: 'mgr-1', decision: 'approved' })

      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledTimes(2)
      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-1', expect.objectContaining({ status: 'approved', reviewed_by: 'mgr-1' }))
      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-2', expect.objectContaining({ status: 'approved', reviewed_by: 'mgr-1' }))
    })

    it('rejects an invalid decision value before touching the repository', async () => {
      await expect(attendanceService.decideFixedOffDayRequestGroup({ ids: ['fod-1'], reviewer_id: 'mgr-1', decision: 'bogus' as any }))
        .rejects.toThrow('Invalid request decision')
      expect(attendanceRepository.getFixedOffDayRequestsByIds).not.toHaveBeenCalled()
    })

    it('rejects an empty ids array', async () => {
      await expect(attendanceService.decideFixedOffDayRequestGroup({ ids: [], reviewer_id: 'mgr-1', decision: 'approved' }))
        .rejects.toThrow('No requests to decide')
    })

    it('throws and updates nothing if any id in the group does not exist', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06')] as any)

      await expect(attendanceService.decideFixedOffDayRequestGroup({ ids: ['fod-1', 'missing'], reviewer_id: 'mgr-1', decision: 'approved' }))
        .rejects.toThrow('Weekly day off request not found')
      expect(attendanceRepository.updateFixedOffDayRequest).not.toHaveBeenCalled()
    })

    it('throws if any row in the group is already an approved auto-assigned row', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue([
        { ...rowFor('fod-auto', '2026-07-06'), status: 'approved', source: 'auto_assigned' },
        rowFor('fod-2', '2026-07-08'),
      ] as any)

      await expect(attendanceService.decideFixedOffDayRequestGroup({ ids: ['fod-auto', 'fod-2'], reviewer_id: 'mgr-1', decision: 'approved' }))
        .rejects.toThrow('auto-assigned')
      expect(attendanceRepository.updateFixedOffDayRequest).not.toHaveBeenCalled()
    })

    it('modifies each row to its paired replacement date (1:1 by array index)', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)
      vi.mocked(attendanceRepository.updateFixedOffDayRequest).mockResolvedValue({} as any)

      await attendanceService.decideFixedOffDayRequestGroup({
        ids: ['fod-1', 'fod-2'], reviewer_id: 'owner-1', decision: 'modified', new_dates: ['2026-07-11', '2026-07-12'],
      })

      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-1', expect.objectContaining({ status: 'modified', request_date: '2026-07-11' }))
      expect(attendanceRepository.updateFixedOffDayRequest).toHaveBeenCalledWith('fod-2', expect.objectContaining({ status: 'modified', request_date: '2026-07-12' }))
    })

    it('rejects modify when new_dates length does not match ids', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)

      await expect(attendanceService.decideFixedOffDayRequestGroup({
        ids: ['fod-1', 'fod-2'], reviewer_id: 'owner-1', decision: 'modified', new_dates: ['2026-07-11'],
      })).rejects.toThrow('1:1')
    })

    it('rejects modify with duplicate replacement dates', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)

      await expect(attendanceService.decideFixedOffDayRequestGroup({
        ids: ['fod-1', 'fod-2'], reviewer_id: 'owner-1', decision: 'modified', new_dates: ['2026-07-11', '2026-07-11'],
      })).rejects.toThrow('not repeat')
    })

    it('rejects modify when a replacement date falls outside the request week', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(
        [rowFor('fod-1', '2026-07-06'), rowFor('fod-2', '2026-07-08')] as any)

      await expect(attendanceService.decideFixedOffDayRequestGroup({
        ids: ['fod-1', 'fod-2'], reviewer_id: 'owner-1', decision: 'modified', new_dates: ['2026-07-11', '2026-07-20'],
      })).rejects.toThrow('same week')
    })
  })

  describe('getFixedOffDayRequests (UC56 — Manager and Employee requests both route to Owner)', () => {
    beforeEach(() => {
      vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue(null)
    })

    it('returns both Manager- and Employee-submitted requests together, with no department scoping', async () => {
      vi.mocked(attendanceRepository.getOffDayRequestsByCompany).mockResolvedValue([
        { id: 'fod-mgr', user_id: 'mgr-1', company_id: 'company-1', request_date: '2026-07-10', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
        { id: 'fod-emp', user_id: 'emp-1', company_id: 'company-1', request_date: '2026-07-10', week_start: '2026-07-06', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'mgr-1', full_name: 'Manager One', role: 'Manager' },
        { id: 'emp-1', full_name: 'Employee One', role: 'Employee' },
      ] as any)
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-ops', department_name: 'Ops' }])
      vi.mocked(attendanceRepository.getEmployeesByCompany).mockResolvedValue([{ id: 'emp-1', full_name: 'Employee One', department_id: 'dept-elsewhere' }])

      const requests = await attendanceService.getFixedOffDayRequests('company-1')

      expect(requests.map(r => r.id).sort()).toEqual(['fod-emp', 'fod-mgr'])
      expect(requests.find(r => r.id === 'fod-mgr')).toEqual(expect.objectContaining({ requester_name: 'Manager One', requester_role: 'Manager' }))
      expect(requests.find(r => r.id === 'fod-emp')).toEqual(expect.objectContaining({ requester_name: 'Employee One', requester_role: 'Employee' }))
    })
  })

  describe('runAutoAssignmentSweepForUpcomingWeek (triggered lazily via getFixedOffDayRequests)', () => {
    // Mirrors the sweep's own date math exactly (toISOString-based todayKey -> weekStart -> +7 days)
    // so "the first day of the upcoming week" lines up with what the sweep itself computes.
    const todayKey = new Date().toISOString().slice(0, 10)
    const thisWeekStart = weekStart(todayKey)
    const addDaysUTC = (dateKey: string, days: number): string => {
      const d = new Date(`${dateKey}T00:00:00`)
      d.setDate(d.getDate() + days)
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const upcomingWeekStart = addDaysUTC(thisWeekStart, 7)
    const reservedDate = upcomingWeekStart // the first day of the upcoming week

    beforeEach(() => {
      const todayDow = new Date().getDay()
      const pastDeadlineDow = (todayDow + 6) % 7 // yesterday's weekday — guaranteed already passed
      vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue({ company_id: 'company-1', deadline_weekday: pastDeadlineDow, deadline_time: '17:00', updated_by: null, updated_at: '2026-01-01' } as any)
      vi.mocked(attendanceRepository.getManagersByCompany).mockResolvedValue([])
      vi.mocked(attendanceRepository.createFixedOffDayRequests).mockResolvedValue([] as any)
      vi.mocked(attendanceRepository.getOffDayRequestsByCompany).mockResolvedValue([])
      vi.mocked(offDaySettingsRepository.getQuotaForUser).mockResolvedValue(null)
      vi.mocked(offDaySettingsRepository.getCompanyDefaultQuota).mockResolvedValue({ company_id: 'company-1', user_id: null, max_days_per_week: 1, role: 'Employee', updated_by: null, updated_at: '2026-01-01' } as any)
    })

    it('reserves an already-submitted off-day before checking auto-assignment safety, so a non-submitter is not also assigned that date when it would drop staffing below minimum', async () => {
      vi.mocked(attendanceRepository.getEmployeesByCompany).mockResolvedValue([
        { id: 'emp-1', full_name: 'Employee One', department_id: 'dept-ops' },
        { id: 'emp-2', full_name: 'Employee Two', department_id: 'dept-ops' },
      ] as any)
      vi.mocked(attendanceRepository.getOffDayRequestsByCompanyAndWeek).mockResolvedValue([
        { id: 'fod-1', user_id: 'emp-1', company_id: 'company-1', request_date: reservedDate, week_start: upcomingWeekStart, status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
      ] as any)
      // dept-ops is normally scheduled with exactly 2 employees every day of the upcoming week —
      // with emp-1 already reserved off on reservedDate, only 1 remains there (meets the MIN_EMPLOYEES_PER_DAY=1
      // floor only if nobody else also takes that day off), so emp-2 must NOT also land on reservedDate.
      // A fresh object per call matters here: the sweep caches+mutates this per (department, date) key,
      // so a shared mockResolvedValue object would let one date's reservation bleed into every other date.
      vi.mocked(attendanceRepository.getScheduledHeadcountForDeptDate).mockImplementation(async () => ({ managers: 0, employees: 2 }))

      await attendanceService.getFixedOffDayRequests('company-1')

      expect(attendanceRepository.createFixedOffDayRequests).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'emp-2', source: 'auto_assigned' })
      )
      const call = vi.mocked(attendanceRepository.createFixedOffDayRequests).mock.calls.find(c => c[0].user_id === 'emp-2')
      expect(call?.[0].dates).not.toContain(reservedDate)
    })

    it('skips the per-department headcount work entirely once everyone already has a row for the week — this was the dominant cost behind the Weekly Day Off tab loading slowly on every visit', async () => {
      vi.mocked(attendanceRepository.getManagersByCompany).mockResolvedValue([{ id: 'mgr-1', full_name: 'Manager One' }] as any)
      vi.mocked(attendanceRepository.getEmployeesByCompany).mockResolvedValue([
        { id: 'emp-1', full_name: 'Employee One', department_id: 'dept-ops' },
      ] as any)
      vi.mocked(attendanceRepository.getOffDayRequestsByCompanyAndWeek).mockResolvedValue([
        { id: 'fod-1', user_id: 'mgr-1', company_id: 'company-1', request_date: reservedDate, week_start: upcomingWeekStart, status: 'approved', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
        { id: 'fod-2', user_id: 'emp-1', company_id: 'company-1', request_date: reservedDate, week_start: upcomingWeekStart, status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
      ] as any)

      await attendanceService.getFixedOffDayRequests('company-1')

      expect(attendanceRepository.getScheduledHeadcountForDeptDate).not.toHaveBeenCalled()
      expect(attendanceRepository.createFixedOffDayRequests).not.toHaveBeenCalled()
    })
  })

  describe('submitFixedOffDayRequest (UC55)', () => {
    // Mirrors weekStart()/addDays() in attendanceService.ts exactly: local-time Date parsing (no
    // 'Z' suffix) and formatting back out via local getters (never toISOString(), which converts
    // to UTC and would silently reintroduce the same skew this test is guarding against).
    const localDateKey = (d: Date): string => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const now = new Date()
    const todayKeyLocal = localDateKey(now)
    const upcomingMonday = (() => {
      const d = new Date(`${todayKeyLocal}T00:00:00`)
      const dow = (d.getDay() + 6) % 7
      d.setDate(d.getDate() - dow + 7)
      return localDateKey(d)
    })()
    const upcomingTuesday = (() => {
      const d = new Date(`${upcomingMonday}T00:00:00`)
      d.setDate(d.getDate() + 1)
      return localDateKey(d)
    })()
    const upcomingWednesday = (() => {
      const d = new Date(`${upcomingMonday}T00:00:00`)
      d.setDate(d.getDate() + 2)
      return localDateKey(d)
    })()

    beforeEach(() => {
      vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue(null)
      vi.mocked(offDaySettingsRepository.getQuotaForUser).mockResolvedValue(null)
      vi.mocked(offDaySettingsRepository.getCompanyDefaultQuota).mockResolvedValue({ company_id: 'company-1', user_id: null, max_days_per_week: 2, role: 'Employee', updated_by: null, updated_at: '2026-01-01' } as any)
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({ id: 'user-1', role: 'Employee', company_id: 'company-1' } as any)
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByUserAndWeek).mockResolvedValue([])
      vi.mocked(attendanceRepository.deleteFixedOffDayRequestsByUserAndWeek).mockResolvedValue(undefined)
      vi.mocked(attendanceRepository.createFixedOffDayRequests).mockResolvedValue([] as any)
    })

    it('rejects a date that is not in the future', async () => {
      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [todayKeyLocal] }))
        .rejects.toThrow('not in the future')
    })

    it('rejects dates spanning two different weeks', async () => {
      const nextWeekStart = (() => {
        const d = new Date(`${upcomingMonday}T00:00:00`)
        d.setDate(d.getDate() + 7)
        return localDateKey(d)
      })()
      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday, nextWeekStart] }))
        .rejects.toThrow('same week')
    })

    it('rejects dates not in the currently open week', async () => {
      const farFuture = (() => {
        const d = new Date(`${upcomingMonday}T00:00:00`)
        d.setDate(d.getDate() + 21)
        return localDateKey(d)
      })()
      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [farFuture] }))
        .rejects.toThrow('currently open week')
    })

    it('shifts the open week forward once its own deadline has passed, rejecting the now-closed upcoming week', async () => {
      const todayDow = now.getDay()
      const pastDeadlineDow = (todayDow + 6) % 7 // yesterday's weekday — guaranteed already passed
      vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue({ company_id: 'company-1', deadline_weekday: pastDeadlineDow, deadline_time: '17:00', updated_by: null, updated_at: '2026-01-01' } as any)

      // upcomingMonday's own deadline has passed, so that window is closed — submitting for it
      // should be rejected, pointing at the week after instead.
      const nextOpenWeek = (() => {
        const d = new Date(`${upcomingMonday}T00:00:00`)
        d.setDate(d.getDate() + 7)
        return localDateKey(d)
      })()
      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday] }))
        .rejects.toThrow(nextOpenWeek)
    })

    it('rejects submission not matching the resolved quota exactly', async () => {
      vi.mocked(offDaySettingsRepository.getCompanyDefaultQuota).mockResolvedValue({ company_id: 'company-1', user_id: null, max_days_per_week: 1, role: 'Employee', updated_by: null, updated_at: '2026-01-01' } as any)

      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday, upcomingTuesday] }))
        .rejects.toThrow('exactly 1')
    })

    it('uses a per-Manager quota override instead of the company default', async () => {
      vi.mocked(offDaySettingsRepository.getQuotaForUser).mockResolvedValue({ company_id: 'company-1', user_id: 'mgr-1', max_days_per_week: 3, role: null, updated_by: 'owner-1', updated_at: '2026-01-01' } as any)

      await attendanceService.submitFixedOffDayRequest({ user_id: 'mgr-1', company_id: 'company-1', dates: [upcomingMonday, upcomingTuesday, upcomingWednesday] })

      expect(offDaySettingsRepository.getCompanyDefaultQuota).not.toHaveBeenCalled()
      expect(attendanceRepository.createFixedOffDayRequests).toHaveBeenCalledWith(expect.objectContaining({ source: 'submitted' }))
    })

    it('rejects resubmission for a week already auto-assigned', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByUserAndWeek).mockResolvedValue([
        { id: 'fod-auto', user_id: 'user-1', company_id: 'company-1', request_date: upcomingMonday, week_start: upcomingMonday, status: 'approved', source: 'auto_assigned', reviewed_by: null, reviewed_at: '2026-01-01', created_at: '2026-01-01' },
      ] as any)

      await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday, upcomingTuesday] }))
        .rejects.toThrow('closed')
    })

    it('succeeds and replaces prior pending rows for the week on the happy path', async () => {
      await attendanceService.submitFixedOffDayRequest({ user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday, upcomingTuesday] })

      expect(attendanceRepository.deleteFixedOffDayRequestsByUserAndWeek).toHaveBeenCalledWith('user-1', 'company-1', upcomingMonday, ['pending', 'rejected'])
      expect(attendanceRepository.createFixedOffDayRequests).toHaveBeenCalledWith({
        user_id: 'user-1', company_id: 'company-1', dates: [upcomingMonday, upcomingTuesday], week_start: upcomingMonday, source: 'submitted',
      })
    })
  })

  describe('resolveDeadlineDateForWeek', () => {
    it('converts a Sunday-start deadline weekday into the correct Monday-start-week date', async () => {
      const { resolveDeadlineDateForWeek } = await import('./attendanceService')
      // Week starting Monday 2026-07-06. deadline_weekday=2 (Tuesday) -> 2026-07-07.
      expect(resolveDeadlineDateForWeek('2026-07-06', 2)).toBe('2026-07-07')
      // deadline_weekday=0 (Sunday) -> last day of that Monday-start week -> 2026-07-12.
      expect(resolveDeadlineDateForWeek('2026-07-06', 0)).toBe('2026-07-12')
      // deadline_weekday=1 (Monday) -> the week_start itself.
      expect(resolveDeadlineDateForWeek('2026-07-06', 1)).toBe('2026-07-06')
    })
  })

  describe('resolveActiveSubmissionWeekStart', () => {
    const todayKey = new Date().toISOString().slice(0, 10)
    const thisWeekStart = weekStart(todayKey)
    const addDaysUTC = (dateKey: string, days: number): string => {
      const d = new Date(`${dateKey}T00:00:00`)
      d.setDate(d.getDate() + days)
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const upcomingWeekStart = addDaysUTC(thisWeekStart, 7)

    it('returns the immediate next week when there is no deadline configured', async () => {
      const { resolveActiveSubmissionWeekStart } = await import('./attendanceService')
      expect(resolveActiveSubmissionWeekStart(todayKey, null)).toBe(upcomingWeekStart)
    })

    it("returns the immediate next week when this week's deadline has not passed yet", async () => {
      const { resolveActiveSubmissionWeekStart } = await import('./attendanceService')
      // Today's own weekday, end-of-day — always still in the future relative to "now" regardless
      // of which day of the week the test happens to run on.
      const todayDow = new Date().getDay()
      expect(resolveActiveSubmissionWeekStart(todayKey, { deadline_weekday: todayDow, deadline_time: '23:59' })).toBe(upcomingWeekStart)
    })

    it("shifts to the week after once this week's deadline has passed", async () => {
      const { resolveActiveSubmissionWeekStart } = await import('./attendanceService')
      const todayDow = new Date().getDay()
      const pastDeadlineDow = (todayDow + 6) % 7 // yesterday's weekday — guaranteed already passed
      expect(resolveActiveSubmissionWeekStart(todayKey, { deadline_weekday: pastDeadlineDow, deadline_time: '17:00' }))
        .toBe(addDaysUTC(upcomingWeekStart, 7))
    })
  })

})
