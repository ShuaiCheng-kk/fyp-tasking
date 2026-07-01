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
    getPendingSwapRequestsByAssignment: vi.fn(),
    createShiftSwapRequest: vi.fn(),
    getTasksByShiftAssignment: vi.fn(),
    getMovableTasksByShiftAssignment: vi.fn(),
    getFixedOffDayRequestsByCompany: vi.fn(),
    getFixedOffDayRequestById: vi.fn(),
    updateFixedOffDayRequest: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/taskRepository', () => ({
  taskRepository: {
    reassignTasksForShiftSwap: vi.fn(),
  },
}))

import { attendanceService } from './attendanceService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { taskRepository } from '@/repositories/owner/taskRepository'

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

    it('blocks approval and does not touch assignments/tasks if a shift has become today by decision time', async () => {
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

      await expect(attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'approved' }))
        .rejects.toThrow('tomorrow or later')

      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
      expect(taskRepository.reassignTasksForShiftSwap).not.toHaveBeenCalled()
      expect(attendanceRepository.updateShiftSwapRequest).not.toHaveBeenCalled()
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
      vi.mocked(attendanceRepository.getShiftAssignmentById).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return { id: 'asn-1', user_id: 'user-1', shifts: { department_id: 'dept-1', shift_date: tomorrowStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } } as any
        if (id === 'asn-2') return { id: 'asn-2', user_id: 'user-2', shifts: { department_id: 'dept-1', shift_date: dayAfterStr, start_time: '09:00', end_time: '17:00', title: 'Shift' } } as any
        return null
      })
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'user-1', full_name: 'Alice', role: 'Employee' },
        { id: 'user-2', full_name: 'Bob', role: 'Employee' },
      ] as any)
      vi.mocked(attendanceRepository.getDepartmentsByIds).mockResolvedValue([{ id: 'dept-1', name: 'Ops' }] as any)
      vi.mocked(attendanceRepository.getTasksByShiftAssignment).mockResolvedValue([])
      vi.mocked(attendanceRepository.getMovableTasksByShiftAssignment).mockImplementation(async (id: string) => {
        if (id === 'asn-1') return [{ id: 'task-1', title: 'Restock shelves', status: 'Assigned', priority: 'Medium', due_at: '2026-07-03T17:00:00Z' }]
        if (id === 'asn-2') return [{ id: 'task-2', title: 'Close register', status: 'In Progress', priority: 'Low', due_at: null }]
        return []
      })

      const requests = await attendanceService.getShiftSwapRequests('company-1')

      expect(requests[0].requester_movable_tasks).toEqual([{ id: 'task-1', title: 'Restock shelves', status: 'Assigned', priority: 'Medium', due_at: '2026-07-03T17:00:00Z' }])
      expect(requests[0].counterpart_movable_tasks).toEqual([{ id: 'task-2', title: 'Close register', status: 'In Progress', priority: 'Low', due_at: null }])
    })
  })

  describe('decideFixedOffDayRequest (UC56: Approve Fixed Day Off)', () => {
    it('approves a pending fixed day off request', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({
        id: 'fod-1', user_id: 'user-1', company_id: 'company-1', weekday: 1, status: 'pending', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01',
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
        .rejects.toThrow('Fixed day off request not found')
    })
  })

  describe('getFixedOffDayRequests (UC56)', () => {
    it('resolves requester names from real user lookups', async () => {
      vi.mocked(attendanceRepository.getFixedOffDayRequestsByCompany).mockResolvedValue([
        { id: 'fod-1', user_id: 'user-1', company_id: 'company-1', weekday: 1, status: 'pending', reviewed_by: null, reviewed_at: null, created_at: '2026-01-01' },
      ] as any)
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'user-1', full_name: 'Bob', role: 'Employee' }] as any)

      const requests = await attendanceService.getFixedOffDayRequests('company-1')

      expect(requests).toEqual([
        expect.objectContaining({ id: 'fod-1', requester_name: 'Bob' }),
      ])
    })
  })

})
