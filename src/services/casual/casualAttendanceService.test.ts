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
    markCasualWorkerDepartmentVerified: vi.fn(),
    getHistoryAssignments: vi.fn(),
    getJobPostingsByIds: vi.fn(),
    getUsersByIds: vi.fn(),
    getCompletedTasksByShiftIds: vi.fn(),
  },
}))

import { casualAttendanceService } from './casualAttendanceService'
import { casualAttendanceRepository } from '@/repositories/casual/casualAttendanceRepository'

const user = { id: 'cw-1', full_name: 'Casual Worker One', role: 'Casual Worker', hourly_rate: null }
const assignment = { id: 'assignment-1', user_id: 'cw-1', shifts: { id: 'shift-1', department_id: 'dept-1', shift_date: '2026-07-01', start_time: '08:00', end_time: '16:00' } } as any

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
      // A completed clock-out is the only thing that promotes this worker into the company's
      // verified Casual Worker pool — must fire regardless of any later approval outcome.
      expect(casualAttendanceRepository.markCasualWorkerDepartmentVerified).toHaveBeenCalledWith('cw-1', 'dept-1')
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

    it('allows clocking out for an open-ended (one-off job) shift once the supervisor has released it', async () => {
      const openEndedAssignment = { ...assignment, shifts: { ...assignment.shifts, is_open_ended: true } }
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(openEndedAssignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, employee_notes: null,
        clock_out_released_at: '2026-07-01T08:45:00Z',
      } as any)
      vi.mocked(casualAttendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await casualAttendanceService.clockOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T09:00:00Z' })

      expect(casualAttendanceRepository.updateAttendanceRecord).toHaveBeenCalled()
      expect(casualAttendanceRepository.markCasualWorkerDepartmentVerified).toHaveBeenCalledWith('cw-1', 'dept-1')
    })

    it('rejects clocking out for an open-ended job until the supervisor has released it', async () => {
      const openEndedAssignment = { ...assignment, shifts: { ...assignment.shifts, is_open_ended: true } }
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(openEndedAssignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, employee_notes: null,
        clock_out_released_at: null,
      } as any)

      await expect(casualAttendanceService.clockOut({
        authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T09:00:00Z',
      })).rejects.toThrow('Waiting for your supervisor to review your work before you can clock out')
      expect(casualAttendanceRepository.updateAttendanceRecord).not.toHaveBeenCalled()
    })

    it('does not promote the worker into the pool when clocking out fails validation (too early)', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, employee_notes: null,
      } as any)

      await expect(casualAttendanceService.clockOut({
        authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T15:00:00Z',
      })).rejects.toThrow()

      expect(casualAttendanceRepository.markCasualWorkerDepartmentVerified).not.toHaveBeenCalled()
    })
  })

  describe('breakIn (UC49)', () => {
    it('throws when not clocked in yet', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      await expect(casualAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Clock in before starting a break')
    })

    it('throws when the shift is already clocked out', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: '2026-07-01T16:00:00Z', break_in_time: null, break_out_time: null,
      } as any)
      await expect(casualAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Shift already clocked out')
    })

    it('throws when already on a break', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, break_in_time: '2026-07-01T12:00:00Z', break_out_time: null,
      } as any)
      await expect(casualAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Already on a break')
    })

    it('throws when the single break for this shift has already been taken', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:30:00Z',
      } as any)
      await expect(casualAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Break already taken for this shift')
    })

    it('sets break_in_time on the clocked-in record', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, break_in_time: null, break_out_time: null,
      } as any)
      vi.mocked(casualAttendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await casualAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1', break_time: '2026-07-01T12:00:00Z' })

      expect(casualAttendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('record-1', {
        break_in_time: '2026-07-01T12:00:00Z',
      })
    })
  })

  describe('breakOut (UC49)', () => {
    it('throws when no break has been started', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, break_in_time: null, break_out_time: null,
      } as any)
      await expect(casualAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('No break started')
    })

    it('throws when the break has already ended', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:30:00Z',
      } as any)
      await expect(casualAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Break already ended')
    })

    it('sets break_out_time when on a break', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(casualAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, break_in_time: '2026-07-01T12:00:00Z', break_out_time: null,
      } as any)
      vi.mocked(casualAttendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await casualAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1', break_time: '2026-07-01T12:30:00Z' })

      expect(casualAttendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('record-1', {
        break_out_time: '2026-07-01T12:30:00Z',
      })
    })
  })

  describe('getHistory', () => {
    beforeEach(() => {
      vi.mocked(casualAttendanceRepository.getCompletedTasksByShiftIds).mockResolvedValue([])
    })

    it('excludes assignments the worker never clocked in to', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getHistoryAssignments).mockResolvedValue([
        { id: 'a-1', supervisor_employee_id: null, shift: { id: 's-1', title: 'Barista', shift_date: '2026-07-01', start_time: '08:00', end_time: '16:00', is_open_ended: false, flat_rate: null, source_job_posting_id: null } },
      ])
      vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'r-1', shift_assignment_id: 'a-1', clock_in_time: null, clock_out_time: null } as any,
      ])
      vi.mocked(casualAttendanceRepository.getJobPostingsByIds).mockResolvedValue([])
      vi.mocked(casualAttendanceRepository.getUsersByIds).mockResolvedValue([])

      const result = await casualAttendanceService.getHistory('auth-1')
      expect(result).toEqual([])
    })

    it('reports a clocked-in-but-not-out shift as working, with no hours or pay yet', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue({ ...user, hourly_rate: 15 })
      vi.mocked(casualAttendanceRepository.getHistoryAssignments).mockResolvedValue([
        { id: 'a-1', supervisor_employee_id: null, shift: { id: 's-1', title: 'Barista', shift_date: '2026-07-01', start_time: '08:00', end_time: '16:00', is_open_ended: false, flat_rate: null, source_job_posting_id: null } },
      ])
      vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'r-1', shift_assignment_id: 'a-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null } as any,
      ])
      vi.mocked(casualAttendanceRepository.getJobPostingsByIds).mockResolvedValue([])
      vi.mocked(casualAttendanceRepository.getUsersByIds).mockResolvedValue([])

      const result = await casualAttendanceService.getHistory('auth-1')
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('working')
      expect(result[0].clock_out_time).toBeNull()
      expect(result[0].hours).toBeNull()
      expect(result[0].pay).toBeNull()
    })

    it('uses the shift flat rate as pay when set, ignoring hourly rate', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue({ ...user, hourly_rate: 15 })
      vi.mocked(casualAttendanceRepository.getHistoryAssignments).mockResolvedValue([
        { id: 'a-1', supervisor_employee_id: 'emp-1', shift: { id: 's-1', title: 'Event Setup', shift_date: '2026-07-01', start_time: '08:00', end_time: '10:00', is_open_ended: true, flat_rate: 80, source_job_posting_id: 'job-1' } },
      ])
      vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'r-1', shift_assignment_id: 'a-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: '2026-07-01T09:00:00Z', employee_notes: 'Loading dock entrance' } as any,
      ])
      vi.mocked(casualAttendanceRepository.getJobPostingsByIds).mockResolvedValue([{ id: 'job-1', company_name: 'Sunrise Hospitality', location: '12 Marina View', created_by: null }])
      vi.mocked(casualAttendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'emp-1', full_name: 'John Tan', role: 'Employee', phone_number: null, email_address: null, profile_photo_url: null }])

      const result = await casualAttendanceService.getHistory('auth-1')
      expect(result).toEqual([{
        id: 'a-1', title: 'Event Setup', job_posting_id: 'job-1', company_name: 'Sunrise Hospitality', location: '12 Marina View',
        supervisor_name: 'John Tan', supervisor_phone: null, supervisor_email: null, supervisor_photo_url: null,
        poster_name: null, poster_role: null, poster_phone: null, poster_email: null, poster_photo_url: null,
        is_open_ended: true, shift_date: '2026-07-01',
        start_time: '08:00', end_time: '10:00', status: 'completed',
        clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: '2026-07-01T09:00:00Z',
        break_in_time: undefined, break_out_time: undefined,
        hours: 1, hourly_rate: 15, flat_rate: 80, pay: 80, notes: 'Loading dock entrance',
        completed_tasks: [],
      }])
    })

    it('falls back to hourly_rate x actual worked hours when the shift has no flat rate', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue({ ...user, hourly_rate: 12 })
      vi.mocked(casualAttendanceRepository.getHistoryAssignments).mockResolvedValue([
        { id: 'a-1', supervisor_employee_id: null, shift: { id: 's-1', title: 'Barista', shift_date: '2026-07-01', start_time: '08:00', end_time: '16:00', is_open_ended: false, flat_rate: null, source_job_posting_id: null } },
      ])
      vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'r-1', shift_assignment_id: 'a-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: '2026-07-01T16:00:00Z' } as any,
      ])
      vi.mocked(casualAttendanceRepository.getJobPostingsByIds).mockResolvedValue([])
      vi.mocked(casualAttendanceRepository.getUsersByIds).mockResolvedValue([])

      const result = await casualAttendanceService.getHistory('auth-1')
      expect(result[0].status).toBe('completed')
      expect(result[0].hours).toBe(8)
      expect(result[0].pay).toBe(96)
    })

    it('subtracts a completed break from worked hours and pay — same formula as the Owner report', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue({ ...user, hourly_rate: 12 })
      vi.mocked(casualAttendanceRepository.getHistoryAssignments).mockResolvedValue([
        { id: 'a-1', supervisor_employee_id: null, shift: { id: 's-1', title: 'Barista', shift_date: '2026-07-01', start_time: '08:00', end_time: '16:00', is_open_ended: false, flat_rate: null, source_job_posting_id: null } },
      ])
      vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'r-1', shift_assignment_id: 'a-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: '2026-07-01T16:00:00Z', break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:30:00Z' } as any,
      ])
      vi.mocked(casualAttendanceRepository.getJobPostingsByIds).mockResolvedValue([])
      vi.mocked(casualAttendanceRepository.getUsersByIds).mockResolvedValue([])

      const result = await casualAttendanceService.getHistory('auth-1')
      expect(result[0].hours).toBe(7.5)
      expect(result[0].pay).toBe(90)
      expect(result[0].break_in_time).toBe('2026-07-01T12:00:00Z')
      expect(result[0].break_out_time).toBe('2026-07-01T12:30:00Z')
    })

    it('reports null pay when neither a flat rate nor an hourly rate is available', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getHistoryAssignments).mockResolvedValue([
        { id: 'a-1', supervisor_employee_id: null, shift: { id: 's-1', title: 'Barista', shift_date: '2026-07-01', start_time: '08:00', end_time: '16:00', is_open_ended: false, flat_rate: null, source_job_posting_id: null } },
      ])
      vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'r-1', shift_assignment_id: 'a-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: '2026-07-01T16:00:00Z' } as any,
      ])
      vi.mocked(casualAttendanceRepository.getJobPostingsByIds).mockResolvedValue([])
      vi.mocked(casualAttendanceRepository.getUsersByIds).mockResolvedValue([])

      const result = await casualAttendanceService.getHistory('auth-1')
      expect(result[0].pay).toBeNull()
    })

    it('attaches supervisor contact details and the completed tasks for that shift', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getHistoryAssignments).mockResolvedValue([
        { id: 'a-1', supervisor_employee_id: 'emp-1', shift: { id: 's-1', title: 'Barista', shift_date: '2026-07-01', start_time: '08:00', end_time: '16:00', is_open_ended: false, flat_rate: null, source_job_posting_id: null } },
      ])
      vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'r-1', shift_assignment_id: 'a-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: '2026-07-01T16:00:00Z' } as any,
      ])
      vi.mocked(casualAttendanceRepository.getJobPostingsByIds).mockResolvedValue([])
      vi.mocked(casualAttendanceRepository.getUsersByIds).mockResolvedValue([
        { id: 'emp-1', full_name: 'Ben Seah', role: 'Employee', phone_number: '+65 8123 4567', email_address: 'ben@sunrise.com', profile_photo_url: 'https://cdn/ben.png' },
      ])
      vi.mocked(casualAttendanceRepository.getCompletedTasksByShiftIds).mockResolvedValue([
        { id: 't-1', shift_id: 's-1', title: 'Sort recycling bins' },
        { id: 't-2', shift_id: 's-1', title: 'Mop storeroom floor' },
        { id: 't-3', shift_id: 's-other', title: 'Unrelated shift task' },
      ])

      const result = await casualAttendanceService.getHistory('auth-1')
      expect(casualAttendanceRepository.getCompletedTasksByShiftIds).toHaveBeenCalledWith(['s-1'], 'cw-1')
      expect(result[0].supervisor_phone).toBe('+65 8123 4567')
      expect(result[0].supervisor_email).toBe('ben@sunrise.com')
      expect(result[0].supervisor_photo_url).toBe('https://cdn/ben.png')
      expect(result[0].completed_tasks).toEqual(['Sort recycling bins', 'Mop storeroom floor'])
    })

    it('lists a same-day working shift ahead of a completed one', async () => {
      vi.mocked(casualAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(casualAttendanceRepository.getHistoryAssignments).mockResolvedValue([
        { id: 'a-done', supervisor_employee_id: null, shift: { id: 's-1', title: 'Morning', shift_date: '2026-07-01', start_time: '08:00', end_time: '12:00', is_open_ended: false, flat_rate: null, source_job_posting_id: null } },
        { id: 'a-live', supervisor_employee_id: null, shift: { id: 's-2', title: 'Evening', shift_date: '2026-07-01', start_time: '17:00', end_time: '21:00', is_open_ended: false, flat_rate: null, source_job_posting_id: null } },
      ])
      vi.mocked(casualAttendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([
        { id: 'r-1', shift_assignment_id: 'a-done', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: '2026-07-01T12:00:00Z' } as any,
        { id: 'r-2', shift_assignment_id: 'a-live', clock_in_time: '2026-07-01T17:00:00Z', clock_out_time: null } as any,
      ])
      vi.mocked(casualAttendanceRepository.getJobPostingsByIds).mockResolvedValue([])
      vi.mocked(casualAttendanceRepository.getUsersByIds).mockResolvedValue([])

      const result = await casualAttendanceService.getHistory('auth-1')
      expect(result.map(e => e.id)).toEqual(['a-live', 'a-done'])
    })
  })
})
