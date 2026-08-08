import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/shiftRepository', () => ({
  shiftRepository: {
    getShiftById: vi.fn(),
    getAssignmentsByShiftIds: vi.fn(),
    updateShift: vi.fn(),
    createShift: vi.fn(),
    createShiftAssignment: vi.fn(),
    createActionHistory: vi.fn(),
    getShiftsByRecurrenceGroupId: vi.fn(),
    deleteAssignmentsByShiftId: vi.fn(),
    deleteShift: vi.fn(),
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

const baseShift = {
  company_id: 'comp-1',
  department_id: 'dept-1',
  start_time: '09:00',
  end_time: '17:00',
  status: 'active' as const,
  publication_status: 'draft' as const,
  recurrence_rule: null,
  split_group_id: null,
  template_id: null,
  source_job_posting_id: null,
  is_open_ended: false,
  hourly_rate: null,
}

describe('UC7 Set Recurring Shift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(attendanceRepository.getAttendanceRecordsByAssignmentIds).mockResolvedValue([])
  })

  it('UC7-M-UT-O: Owner sets a weekly recurring rule on an existing shift', async () => {
    const original = { ...baseShift, id: 'shift-1', shift_date: '2026-08-10', recurrence_group_id: null, source_shift_id: null, created_by: 'owner-1' }
    const generated = { ...baseShift, id: 'shift-2', shift_date: '2026-08-17', recurrence_group_id: 'rec-1', recurrence_rule: 'weekly' as const, source_shift_id: 'shift-1', created_by: 'owner-1' }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([{
      id: 'assign-1', shift_id: 'shift-1', user_id: 'emp-1', assigned_by: 'owner-1',
      supervisor_employee_id: null, user_name_snapshot: null, created_at: '2026-08-01T00:00:00.000Z',
    }])
    vi.mocked(shiftRepository.updateShift).mockResolvedValue(original)
    vi.mocked(shiftRepository.createShift).mockResolvedValue(generated)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({
      id: 'assign-2', shift_id: 'shift-2', user_id: 'emp-1', assigned_by: 'owner-1',
      supervisor_employee_id: null, user_name_snapshot: null, created_at: '2026-08-01T00:00:00.000Z',
    })
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.createRecurringShifts('shift-1', {
      created_by: 'owner-1',
      recurrence_rule: 'weekly',
      recurrence_end_date: '2026-08-17',
    })

    expect(result).toEqual([generated])
    expect(shiftRepository.createShift).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createShift).toHaveBeenCalledWith(expect.objectContaining({
      shift_date: '2026-08-17',
      source_shift_id: 'shift-1',
      recurrence_rule: 'weekly',
      publication_status: 'draft',
    }))
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith(expect.objectContaining({
      shift_id: 'shift-2',
      user_id: 'emp-1',
    }))
  })

  it('UC7-M-UT-P: Partner sets a weekly recurring rule on an existing shift', async () => {
    const original = { ...baseShift, id: 'shift-3', shift_date: '2026-08-10', recurrence_group_id: null, source_shift_id: null, created_by: 'partner-1' }
    const generated = { ...baseShift, id: 'shift-4', shift_date: '2026-08-17', recurrence_group_id: 'rec-2', recurrence_rule: 'weekly' as const, source_shift_id: 'shift-3', created_by: 'partner-1' }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([{
      id: 'assign-3', shift_id: 'shift-3', user_id: 'emp-2', assigned_by: 'partner-1',
      supervisor_employee_id: null, user_name_snapshot: null, created_at: '2026-08-01T00:00:00.000Z',
    }])
    vi.mocked(shiftRepository.updateShift).mockResolvedValue(original)
    vi.mocked(shiftRepository.createShift).mockResolvedValue(generated)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({
      id: 'assign-4', shift_id: 'shift-4', user_id: 'emp-2', assigned_by: 'partner-1',
      supervisor_employee_id: null, user_name_snapshot: null, created_at: '2026-08-01T00:00:00.000Z',
    })
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.createRecurringShifts('shift-3', {
      created_by: 'partner-1',
      recurrence_rule: 'weekly',
      recurrence_end_date: '2026-08-17',
    })

    expect(result).toEqual([generated])
    expect(shiftRepository.createShift).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createShift).toHaveBeenCalledWith(expect.objectContaining({
      shift_date: '2026-08-17',
      source_shift_id: 'shift-3',
      recurrence_rule: 'weekly',
      publication_status: 'draft',
    }))
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith(expect.objectContaining({
      shift_id: 'shift-4',
      user_id: 'emp-2',
    }))
  })

  it('UC7-A1-UT-O: Owner deletes the original shift of a recurring series', async () => {
    const original = { ...baseShift, id: 'shift-10', shift_date: '2026-08-10', recurrence_group_id: 'rec-10', source_shift_id: null, created_by: 'owner-1' }
    const sibling1 = { ...baseShift, id: 'shift-11', shift_date: '2026-08-17', recurrence_group_id: 'rec-10', source_shift_id: 'shift-10', created_by: 'owner-1' }
    const sibling2 = { ...baseShift, id: 'shift-12', shift_date: '2026-08-24', recurrence_group_id: 'rec-10', source_shift_id: 'shift-10', created_by: 'owner-1' }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
    vi.mocked(shiftRepository.getShiftsByRecurrenceGroupId).mockResolvedValue([original, sibling1, sibling2])
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
    vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.deleteShift('shift-10', 'owner-1')

    expect(result).toEqual({ skipped_shifts: [] })
    expect(shiftRepository.deleteShift).toHaveBeenCalledTimes(3)
    expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-10')
    expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-11')
    expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-12')
  })

  it('UC7-A1-UT-P: Partner deletes the original shift of a recurring series', async () => {
    const original = { ...baseShift, id: 'shift-13', shift_date: '2026-08-10', recurrence_group_id: 'rec-11', source_shift_id: null, created_by: 'partner-1' }
    const sibling1 = { ...baseShift, id: 'shift-14', shift_date: '2026-08-17', recurrence_group_id: 'rec-11', source_shift_id: 'shift-13', created_by: 'partner-1' }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(original)
    vi.mocked(shiftRepository.getShiftsByRecurrenceGroupId).mockResolvedValue([original, sibling1])
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
    vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.deleteShift('shift-13', 'partner-1')

    expect(result).toEqual({ skipped_shifts: [] })
    expect(shiftRepository.deleteShift).toHaveBeenCalledTimes(2)
    expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-13')
    expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-14')
  })

  it('UC7-A2-UT-O: Owner deletes a single non-original shift from a recurring series', async () => {
    const part = { ...baseShift, id: 'shift-21', shift_date: '2026-08-17', recurrence_group_id: 'rec-20', source_shift_id: 'shift-20', created_by: 'owner-1' }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(part)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
    vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.deleteShift('shift-21', 'owner-1')

    expect(result).toEqual({ skipped_shifts: [] })
    expect(shiftRepository.getShiftsByRecurrenceGroupId).not.toHaveBeenCalled()
    expect(shiftRepository.deleteShift).toHaveBeenCalledTimes(1)
    expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-21')
  })

  it('UC7-A2-UT-P: Partner deletes a single non-original shift from a recurring series', async () => {
    const part = { ...baseShift, id: 'shift-22', shift_date: '2026-08-17', recurrence_group_id: 'rec-21', source_shift_id: 'shift-20', created_by: 'partner-1' }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(part)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
    vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.deleteShift).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.deleteShift('shift-22', 'partner-1')

    expect(result).toEqual({ skipped_shifts: [] })
    expect(shiftRepository.getShiftsByRecurrenceGroupId).not.toHaveBeenCalled()
    expect(shiftRepository.deleteShift).toHaveBeenCalledTimes(1)
    expect(shiftRepository.deleteShift).toHaveBeenCalledWith('shift-22')
  })
})
