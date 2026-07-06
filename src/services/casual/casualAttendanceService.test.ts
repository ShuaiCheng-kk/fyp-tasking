import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/casual/casualAttendanceRepository', () => ({
  casualAttendanceRepository: {
    getUserByAuthId: vi.fn(),
    getUpcomingAssignments: vi.fn(),
    getAssignmentById: vi.fn(),
    getAttendanceRecordsByAssignmentIds: vi.fn(),
    getAttendanceRecordByAssignmentId: vi.fn(),
    createAttendanceRecord: vi.fn(),
    updateAttendanceRecord: vi.fn(),
  },
}))

import { casualAttendanceService } from './casualAttendanceService'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'

const user = { id: 'cw-1', full_name: 'Casual Worker One', role: 'Casual Worker' }
const assignment = { id: 'assignment-1', user_id: 'cw-1', shifts: { id: 'shift-1', shift_date: '2026-07-01', start_time: '08:00', end_time: '16:00' } } as any

describe('casualAttendanceService — Clock In / Clock Out (UC49)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAttendance', () => {
    it('throws when no auth id is provided', async () => {
      await expect(casualAttendanceService.getAttendance('')).rejects.toThrow('Missing user id')
    })

    it('throws when the casual worker cannot be found', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(null)
      await expect(casualAttendanceService.getAttendance('auth-1')).rejects.toThrow('Casual worker not found')
    })

    it('reports no active shift when there are no upcoming assignments', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getUpcomingAssignments).mockResolvedValue([])
      vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])

      const result = await casualAttendanceService.getAttendance('auth-1')

      expect(result.shifts).toEqual([])
      expect(result.message).toBe('No active shift.')
    })

    it('pairs each assignment with its attendance record, dropping assignments with no shift', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getUpcomingAssignments).mockResolvedValue([
        assignment,
        { id: 'assignment-2', user_id: 'cw-1', shifts: null },
      ] as any)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'record-1', shift_assignment_id: 'assignment-1', clock_in_time: null, clock_out_time: null },
      ] as any)

      const result = await casualAttendanceService.getAttendance('auth-1')

      expect(result.shifts).toHaveLength(1)
      expect(result.shifts[0].record?.id).toBe('record-1')
      expect(result.message).toBe('Attendance loaded.')
    })
  })

  describe('clockIn', () => {
    it('throws when the casual worker cannot be found', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(null)
      await expect(casualAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Casual worker not found')
    })

    it('throws when the assignment does not belong to this worker', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue({ ...assignment, user_id: 'someone-else' } as any)
      await expect(casualAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Shift assignment not found for casual worker')
    })

    it('throws when already clocked in for this shift', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z' } as any)
      await expect(casualAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Already clocked in for this shift')
    })

    it('rejects clocking in more than 30 minutes before the shift starts (UC49)', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      await expect(casualAttendanceService.clockIn({
        authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T07:00:00Z',
      })).rejects.toThrow('Too early to clock in for this shift')
    })

    it('allows clocking in exactly at the 30-minute-early window', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      vi.mocked(casualAttendanceRepository.createAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await casualAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T07:30:00Z' })

      expect(casualAttendanceRepository.createAttendanceRecord).toHaveBeenCalled()
    })

    it('rounds a clock-in within the 10-minute grace period down to the scheduled start (UC49)', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      vi.mocked(casualAttendanceRepository.createAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await casualAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T08:07:00Z' })

      expect(casualAttendanceRepository.createAttendanceRecord).toHaveBeenCalledWith(
        expect.objectContaining({ clock_in_time: '2026-07-01T08:00:00.000Z' })
      )
    })

    it('records the actual clock-in time once past the 10-minute grace period', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      vi.mocked(casualAttendanceRepository.createAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await casualAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T08:15:00Z' })

      expect(casualAttendanceRepository.createAttendanceRecord).toHaveBeenCalledWith(
        expect.objectContaining({ clock_in_time: '2026-07-01T08:15:00.000Z' })
      )
    })

    it('creates a new attendance record when none exists yet', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      vi.mocked(casualAttendanceRepository.createAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await casualAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T08:00:00Z', notes: 'On time' })

      expect(casualAttendanceRepository.createAttendanceRecord).toHaveBeenCalledWith({
        shift_assignment_id: 'assignment-1',
        casual_worker_id: 'cw-1',
        clock_in_time: '2026-07-01T08:00:00.000Z',
        confirmed_by_employee_id: 'cw-1',
        submitted_by_employee_id: 'cw-1',
        status: 'clocked_in',
        employee_notes: 'On time',
        owner_status: 'pending',
      })
    })

    it('reuses an existing record (e.g. re-clocking after a reset) instead of creating a new one', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'record-1', clock_in_time: null, employee_notes: 'Old note' } as any)
      vi.mocked(casualAttendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await casualAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T08:00:00Z' })

      expect(casualAttendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('record-1', {
        clock_in_time: '2026-07-01T08:00:00.000Z',
        confirmed_by_employee_id: 'cw-1',
        status: 'clocked_in',
        employee_notes: 'Old note',
      })
      expect(casualAttendanceRepository.createAttendanceRecord).not.toHaveBeenCalled()
    })
  })

  describe('clockOut', () => {
    it('throws when not clocked in yet', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      await expect(casualAttendanceService.clockOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Clock in before clocking out')
    })

    it('throws when already clocked out', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: '2026-07-01T16:00:00Z',
      } as any)
      await expect(casualAttendanceService.clockOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Already clocked out for this shift')
    })

    it('records the clock-out time and marks the record submitted', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, employee_notes: null,
      } as any)
      vi.mocked(casualAttendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await casualAttendanceService.clockOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T16:00:00Z', notes: 'Done' })

      expect(casualAttendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('record-1', {
        clock_out_time: '2026-07-01T16:00:00Z',
        submitted_by_employee_id: 'cw-1',
        employee_notes: 'Done',
        status: 'submitted',
      })
    })

    it('rejects clocking out before the shift has reached its scheduled end time (UC49)', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, employee_notes: null,
      } as any)

      await expect(casualAttendanceService.clockOut({
        authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T15:00:00Z',
      })).rejects.toThrow('Too early to clock out — wait until the shift ends')
    })

    it('allows clocking out anytime for an open-ended (one-off job) shift, even before its placeholder end time', async () => {
      const openEndedAssignment = { ...assignment, shifts: { ...assignment.shifts, is_open_ended: true } }
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(openEndedAssignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, employee_notes: null,
      } as any)
      vi.mocked(casualAttendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await casualAttendanceService.clockOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T09:00:00Z' })

      expect(casualAttendanceRepository.updateAttendanceRecord).toHaveBeenCalled()
    })
  })
})
