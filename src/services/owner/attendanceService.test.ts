import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getAssignmentsByCompany: vi.fn(),
    getAttendanceRecordsByAssignmentIds: vi.fn(),
    getAttendanceRecordById: vi.fn(),
    updateAttendanceRecord: vi.fn(),
    getUsersByIds: vi.fn(),
    getDepartmentsByIds: vi.fn(),
    getTimeOffRequestsByCompany: vi.fn(),
    updateTimeOffRequest: vi.fn(),
    getShiftSwapRequestsByCompany: vi.fn(),
    getShiftSwapRequestById: vi.fn(),
    updateShiftSwapRequest: vi.fn(),
    updateShiftAssignmentUser: vi.fn(),
    getFixedOffDayRequestsByCompany: vi.fn(),
    getFixedOffDayRequestById: vi.fn(),
    updateFixedOffDayRequest: vi.fn(),
  },
}))

import { attendanceService } from './attendanceService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'

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
  })

  describe('decideShiftSwapRequest (UC53: Approve Shift Swap Request)', () => {
    it('reassigns the shift to the replacement user on approval', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue({
        id: 'swap-1', shift_assignment_id: 'asn-1', replacement_user_id: 'user-2',
      } as any)
      vi.mocked(attendanceRepository.updateShiftAssignmentUser).mockResolvedValue({} as any)
      vi.mocked(attendanceRepository.updateShiftSwapRequest).mockResolvedValue({ id: 'swap-1', status: 'approved' } as any)

      await attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'approved' })

      expect(attendanceRepository.updateShiftAssignmentUser).toHaveBeenCalledWith('asn-1', 'user-2')
      expect(attendanceRepository.updateShiftSwapRequest).toHaveBeenCalledWith('swap-1', expect.objectContaining({ status: 'approved', reviewed_by: 'owner-1' }))
    })

    it('does not reassign the shift on rejection', async () => {
      vi.mocked(attendanceRepository.getShiftSwapRequestById).mockResolvedValue({
        id: 'swap-1', shift_assignment_id: 'asn-1', replacement_user_id: 'user-2',
      } as any)
      vi.mocked(attendanceRepository.updateShiftSwapRequest).mockResolvedValue({ id: 'swap-1', status: 'rejected' } as any)

      await attendanceService.decideShiftSwapRequest({ id: 'swap-1', reviewer_id: 'owner-1', decision: 'rejected' })

      expect(attendanceRepository.updateShiftAssignmentUser).not.toHaveBeenCalled()
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

  describe('decideTimeOffRequest (UC58: Approve Leave Request)', () => {
    it('approves a pending leave/time-off/break-waiver request', async () => {
      vi.mocked(attendanceRepository.updateTimeOffRequest).mockResolvedValue({ id: 'to-1', status: 'approved' } as any)

      await attendanceService.decideTimeOffRequest({ id: 'to-1', reviewer_id: 'owner-1', decision: 'approved' })

      expect(attendanceRepository.updateTimeOffRequest).toHaveBeenCalledWith('to-1', expect.objectContaining({ status: 'approved', reviewed_by: 'owner-1' }))
    })

    it('rejects an invalid decision value', async () => {
      await expect(attendanceService.decideTimeOffRequest({ id: 'to-1', reviewer_id: 'owner-1', decision: 'bogus' as any }))
        .rejects.toThrow('Invalid request decision')
      expect(attendanceRepository.updateTimeOffRequest).not.toHaveBeenCalled()
    })
  })
})
