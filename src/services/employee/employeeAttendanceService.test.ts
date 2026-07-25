import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/employee/employeeAttendanceRepository', () => ({
  employeeAttendanceRepository: {
    getAttendanceRecords: vi.fn(),
    getUserByAuthId: vi.fn(),
    getAssignmentById: vi.fn(),
    getAttendanceRecordByAssignmentId: vi.fn(),
    getAttendanceRecordsByAssignmentIds: vi.fn(),
    getUpcomingAssignments: vi.fn(),
    createAttendanceRecord: vi.fn(),
    updateAttendanceRecord: vi.fn(),
    getPendingClockOutReleases: vi.fn(),
    getAttendanceRecordWithSupervisor: vi.fn(),
    releaseClockOut: vi.fn(),
    getUsersByIds: vi.fn(),
  },
}))

import { employeeAttendanceService } from './employeeAttendanceService'
import { employeeAttendanceRepository } from '@/repositories/employee/employeeAttendanceRepository'

const user = { id: 'emp-1', full_name: 'Employee One', role: 'Employee' }
const assignment = { id: 'assignment-1', user_id: 'emp-1', shifts: { id: 'shift-1', shift_date: '2026-07-01', start_time: '08:00', end_time: '16:00', is_open_ended: false } } as any
const repo = () => employeeAttendanceRepository as any

describe('employeeAttendanceService — Review Attendance Record (UC50)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAttendanceRecords', () => {
    it('delegates straight to the repository', async () => {
      const records = [{ id: 'record-1', status: 'submitted' }] as any
      vi.mocked(employeeAttendanceRepository.getAttendanceRecords).mockResolvedValue(records)

      const result = await employeeAttendanceService.getAttendanceRecords('auth-1')

      expect(employeeAttendanceRepository.getAttendanceRecords).toHaveBeenCalledWith('auth-1')
      expect(result).toEqual(records)
    })
  })
})

describe('employeeAttendanceService — Clock In / Clock Out (UC49, shared with Manager)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('clockIn', () => {
    it('throws when the user cannot be found', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(null)
      await expect(employeeAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('User not found')
    })

    it('throws when the assignment does not belong to this user', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue({ ...assignment, user_id: 'someone-else' })
      await expect(employeeAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Shift assignment not found for this user')
    })

    it('throws when already clocked in', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({ id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z' } as any)
      await expect(employeeAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Already clocked in for this shift')
    })

    it('rejects clocking in more than 30 minutes before the shift starts', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      await expect(employeeAttendanceService.clockIn({
        authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T07:00:00Z',
      })).rejects.toThrow('Too early to clock in for this shift')
    })

    it('rounds a clock-in within the 10-minute grace period down to the scheduled start', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      vi.mocked(employeeAttendanceRepository.createAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await employeeAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T08:07:00Z' })

      expect(employeeAttendanceRepository.createAttendanceRecord).toHaveBeenCalledWith(
        expect.objectContaining({ clock_in_time: '2026-07-01T08:00:00.000Z', confirmed_by_employee_id: 'emp-1' })
      )
    })

    it('records the actual clock-in time once past the grace period', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      vi.mocked(employeeAttendanceRepository.createAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await employeeAttendanceService.clockIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T08:20:00Z' })

      expect(employeeAttendanceRepository.createAttendanceRecord).toHaveBeenCalledWith(
        expect.objectContaining({ clock_in_time: '2026-07-01T08:20:00.000Z' })
      )
    })
  })

  describe('clockOut', () => {
    it('throws when not clocked in yet', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
      await expect(employeeAttendanceService.clockOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
        .rejects.toThrow('Clock in before clocking out')
    })

    it('rejects clocking out before the shift has reached its scheduled end time', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, employee_notes: null,
      } as any)

      await expect(employeeAttendanceService.clockOut({
        authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T15:00:00Z',
      })).rejects.toThrow('Too early to clock out — wait until the shift ends')
    })

    it('records the clock-out time at/after the scheduled end time', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAssignmentById).mockResolvedValue(assignment)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
        id: 'record-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, employee_notes: null,
      } as any)
      vi.mocked(employeeAttendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'record-1' } as any)

      await employeeAttendanceService.clockOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1', clock_time: '2026-07-01T16:00:00Z', notes: 'Done' })

      expect(employeeAttendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('record-1', {
        clock_out_time: '2026-07-01T16:00:00Z',
        submitted_by_employee_id: 'emp-1',
        employee_notes: 'Done',
        status: 'submitted',
      })
    })
  })
})

describe('employeeAttendanceService — breakIn (UC49)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sets break_in_time on an existing clocked-in record', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
      id: 'ar-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, break_in_time: null, break_out_time: null,
    } as any)
    vi.mocked(employeeAttendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'ar-1' } as any)

    await employeeAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' })

    expect(employeeAttendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('ar-1', expect.objectContaining({
      break_in_time: expect.any(String),
    }))
  })

  it('throws if not clocked in', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue(null)
    await expect(employeeAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
      .rejects.toThrow('Clock in before taking a break')
  })

  it('throws if already on break', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
      id: 'ar-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, break_in_time: '2026-07-01T12:00:00Z', break_out_time: null,
    } as any)
    await expect(employeeAttendanceService.breakIn({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
      .rejects.toThrow('Already on a break')
  })
})

describe('employeeAttendanceService — breakOut (UC49)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sets break_out_time when on break', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
      id: 'ar-1', clock_in_time: '2026-07-01T08:00:00Z', break_in_time: '2026-07-01T12:00:00Z', break_out_time: null,
    } as any)
    vi.mocked(employeeAttendanceRepository.updateAttendanceRecord).mockResolvedValue({ id: 'ar-1' } as any)

    await employeeAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1' })

    expect(employeeAttendanceRepository.updateAttendanceRecord).toHaveBeenCalledWith('ar-1', expect.objectContaining({
      break_out_time: expect.any(String),
    }))
  })

  it('throws if no break started', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
      id: 'ar-1', clock_in_time: '2026-07-01T08:00:00Z', break_in_time: null, break_out_time: null,
    } as any)
    await expect(employeeAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
      .rejects.toThrow('No break started')
  })

  it('throws if break already ended', async () => {
    vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
    vi.mocked(employeeAttendanceRepository.getAttendanceRecordByAssignmentId).mockResolvedValue({
      id: 'ar-1', clock_in_time: '2026-07-01T08:00:00Z', break_in_time: '2026-07-01T12:00:00Z', break_out_time: '2026-07-01T12:30:00Z',
    } as any)
    await expect(employeeAttendanceService.breakOut({ authId: 'auth-1', shift_assignment_id: 'assignment-1' }))
      .rejects.toThrow('Break already ended')
  })
})

describe('employeeAttendanceService — Casual Worker Clock-Out Release (one-off jobs)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getClockOutReleaseQueue', () => {
    it('attaches the worker name to each pending release', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getPendingClockOutReleases).mockResolvedValue([
        { id: 'ar-1', casual_worker_id: 'cw-1', clock_in_time: '2026-07-01T08:00:00Z', shift_title: 'Event Setup', shift_date: '2026-07-01', start_time: '08:00' },
      ])
      vi.mocked(employeeAttendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'cw-1', full_name: 'Wei Jie Lim' }])

      const result = await employeeAttendanceService.getClockOutReleaseQueue('auth-1')

      expect(result).toEqual([{
        id: 'ar-1', casual_worker_id: 'cw-1', clock_in_time: '2026-07-01T08:00:00Z',
        shift_title: 'Event Setup', shift_date: '2026-07-01', start_time: '08:00',
        worker_name: 'Wei Jie Lim',
      }])
    })
  })

  describe('releaseClockOut', () => {
    const supervisedRecord = {
      id: 'ar-1', clock_in_time: '2026-07-01T08:00:00Z', clock_out_time: null, clock_out_released_at: null,
      shift_assignments: { supervisor_employee_id: 'emp-1', shifts: { is_open_ended: true } },
    } as any

    it('throws when the acting employee does not supervise this worker', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordWithSupervisor).mockResolvedValue({
        ...supervisedRecord, shift_assignments: { supervisor_employee_id: 'someone-else', shifts: { is_open_ended: true } },
      })

      await expect(employeeAttendanceService.releaseClockOut('auth-1', 'ar-1'))
        .rejects.toThrow('You are not the supervisor for this worker')
    })

    it('throws when the shift is not open-ended', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordWithSupervisor).mockResolvedValue({
        ...supervisedRecord, shift_assignments: { supervisor_employee_id: 'emp-1', shifts: { is_open_ended: false } },
      })

      await expect(employeeAttendanceService.releaseClockOut('auth-1', 'ar-1'))
        .rejects.toThrow('Clock-out release only applies to one-off jobs')
    })

    it('throws when already released', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordWithSupervisor).mockResolvedValue({
        ...supervisedRecord, clock_out_released_at: '2026-07-01T09:00:00Z',
      })

      await expect(employeeAttendanceService.releaseClockOut('auth-1', 'ar-1'))
        .rejects.toThrow('Already released')
    })

    it('releases the clock-out for a supervised, open-ended, not-yet-released record', async () => {
      vi.mocked(employeeAttendanceRepository.getUserByAuthId).mockResolvedValue(user)
      vi.mocked(employeeAttendanceRepository.getAttendanceRecordWithSupervisor).mockResolvedValue(supervisedRecord)
      vi.mocked(employeeAttendanceRepository.releaseClockOut).mockResolvedValue({ id: 'ar-1' } as any)

      await employeeAttendanceService.releaseClockOut('auth-1', 'ar-1')

      expect(employeeAttendanceRepository.releaseClockOut).toHaveBeenCalledWith('ar-1', 'emp-1')
    })
  })
})
