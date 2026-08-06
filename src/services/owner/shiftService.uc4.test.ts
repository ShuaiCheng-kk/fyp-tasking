import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/shiftRepository', () => ({
  shiftRepository: {
    getShiftById: vi.fn(),
    getAssignmentsByShiftIds: vi.fn(),
    deleteAssignmentsByShiftId: vi.fn(),
    deleteShift: vi.fn(),
    createActionHistory: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getAttendanceRecordsByAssignmentIds: vi.fn(),
  },
}))

import { shiftService } from './shiftService'
import { shiftRepository } from '@/repositories/owner/shiftRepository'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'

describe('UC4 Delete Shift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC4-M-UT-O: Owner deletes an existing shift with no attendance recorded', async () => {
    const shift = {
      id: 'shift-1',
      company_id: 'comp-1',
      department_id: 'dept-1',
      shift_date: '2026-08-10',
      start_time: '09:00',
      end_time: '17:00',
      status: 'active' as const,
      publication_status: 'draft' as const,
      recurrence_group_id: null,
      recurrence_rule: null,
      source_shift_id: null,
      split_group_id: null,
      template_id: null,
      source_job_posting_id: null,
      is_open_ended: false,
      hourly_rate: null,
      created_by: 'owner-1',
    }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(shift)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
    vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
    vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.deleteShift('shift-1', 'owner-1')

    expect(result).toEqual({ skipped_shifts: [] })
    expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-1', 'delete')
    expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-1')
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })

  it('UC4-M-UT-P: Partner deletes an existing shift with no attendance recorded', async () => {
    const shift = {
      id: 'shift-2',
      company_id: 'comp-1',
      department_id: 'dept-1',
      shift_date: '2026-08-10',
      start_time: '09:00',
      end_time: '17:00',
      status: 'active' as const,
      publication_status: 'draft' as const,
      recurrence_group_id: null,
      recurrence_rule: null,
      source_shift_id: null,
      split_group_id: null,
      template_id: null,
      source_job_posting_id: null,
      is_open_ended: false,
      hourly_rate: null,
      created_by: 'partner-1',
    }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(shift)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
    vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
    vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.deleteShift('shift-2', 'partner-1')

    expect(result).toEqual({ skipped_shifts: [] })
    expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-2', 'delete')
    expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-2')
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })

  it('UC4-A1-UT-O: Owner attempts to delete a shift that already has attendance recorded', async () => {
    const shift = {
      id: 'shift-3',
      company_id: 'comp-1',
      department_id: 'dept-1',
      shift_date: '2026-08-10',
      start_time: '09:00',
      end_time: '17:00',
      status: 'active' as const,
      publication_status: 'published' as const,
      recurrence_group_id: null,
      recurrence_rule: null,
      source_shift_id: null,
      split_group_id: null,
      template_id: null,
      source_job_posting_id: null,
      is_open_ended: false,
      hourly_rate: null,
      created_by: 'owner-1',
    }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(shift)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([{
      id: 'assign-3',
      shift_id: 'shift-3',
      user_id: 'emp-1',
      assigned_by: 'owner-1',
      supervisor_employee_id: null,
      user_name_snapshot: null,
      created_at: '2026-08-01T00:00:00.000Z',
    }])
    vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([{
      id: 'record-1',
      shift_assignment_id: 'assign-3',
    } as never])

    await expect(shiftService.deleteShift('shift-3', 'owner-1'))
      .rejects.toThrow('Cannot delete this shift — attendance has already been recorded against it.')

    expect(shiftRepository.deleteAssignmentsByShiftId).not.toHaveBeenCalled()
    expect(shiftRepository.deleteShift).not.toHaveBeenCalled()
  })

  it('UC4-A1-UT-P: Partner attempts to delete a shift that already has attendance recorded', async () => {
    const shift = {
      id: 'shift-4',
      company_id: 'comp-1',
      department_id: 'dept-1',
      shift_date: '2026-08-10',
      start_time: '09:00',
      end_time: '17:00',
      status: 'active' as const,
      publication_status: 'published' as const,
      recurrence_group_id: null,
      recurrence_rule: null,
      source_shift_id: null,
      split_group_id: null,
      template_id: null,
      source_job_posting_id: null,
      is_open_ended: false,
      hourly_rate: null,
      created_by: 'partner-1',
    }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(shift)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([{
      id: 'assign-4',
      shift_id: 'shift-4',
      user_id: 'emp-1',
      assigned_by: 'partner-1',
      supervisor_employee_id: null,
      user_name_snapshot: null,
      created_at: '2026-08-01T00:00:00.000Z',
    }])
    vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([{
      id: 'record-2',
      shift_assignment_id: 'assign-4',
    } as never])

    await expect(shiftService.deleteShift('shift-4', 'partner-1'))
      .rejects.toThrow('Cannot delete this shift — attendance has already been recorded against it.')

    expect(shiftRepository.deleteAssignmentsByShiftId).not.toHaveBeenCalled()
    expect(shiftRepository.deleteShift).not.toHaveBeenCalled()
  })
})
