import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/shiftRepository', () => ({
  shiftRepository: {
    getAssignmentsByUserAndDateRange: vi.fn(),
    createShift: vi.fn(),
    createShiftAssignment: vi.fn(),
    createActionHistory: vi.fn(),
  },
}))

import { shiftService } from './shiftService'
import { shiftRepository } from '@/repositories/owner/shiftRepository'

describe('UC8 Create Split Shift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([])
  })

  it('UC8-M-UT-O: Owner splits a single shift into two sub-shifts with a break in between', async () => {
    const morningShift = {
      id: 'shift-1', company_id: 'comp-1', department_id: 'dept-1', shift_date: '2026-08-10',
      start_time: '09:00', end_time: '12:00', status: 'active' as const, publication_status: 'draft' as const,
      recurrence_group_id: null, recurrence_rule: null, source_shift_id: null, split_group_id: 'split-1',
      template_id: null, source_job_posting_id: null, is_open_ended: false, hourly_rate: null, created_by: 'owner-1',
    }
    const afternoonShift = { ...morningShift, id: 'shift-2', start_time: '13:00', end_time: '17:00' }

    vi.mocked(shiftRepository.createShift)
      .mockResolvedValueOnce(morningShift)
      .mockResolvedValueOnce(afternoonShift)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({
      id: 'assign-x', shift_id: 'shift-1', user_id: 'emp-1', assigned_by: 'owner-1',
      supervisor_employee_id: null, user_name_snapshot: null, created_at: '2026-08-01T00:00:00.000Z',
    })
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.createSplitShift({
      company_id: 'comp-1',
      department_id: 'dept-1',
      shift_date: '2026-08-10',
      created_by: 'owner-1',
      assigned_user_id: 'emp-1',
      blocks: [
        { start_time: '09:00', end_time: '12:00' },
        { start_time: '13:00', end_time: '17:00' },
      ],
    })

    expect(result).toEqual({ shifts: [morningShift, afternoonShift], warning: null })
    expect(shiftRepository.createShift).toHaveBeenCalledTimes(2)
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledTimes(2)
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith(expect.objectContaining({ shift_id: 'shift-1', user_id: 'emp-1' }))
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith(expect.objectContaining({ shift_id: 'shift-2', user_id: 'emp-1' }))
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })

  it('UC8-M-UT-P: Partner splits a single shift into two sub-shifts with a break in between', async () => {
    const morningShift = {
      id: 'shift-3', company_id: 'comp-1', department_id: 'dept-1', shift_date: '2026-08-10',
      start_time: '09:00', end_time: '12:00', status: 'active' as const, publication_status: 'draft' as const,
      recurrence_group_id: null, recurrence_rule: null, source_shift_id: null, split_group_id: 'split-2',
      template_id: null, source_job_posting_id: null, is_open_ended: false, hourly_rate: null, created_by: 'partner-1',
    }
    const afternoonShift = { ...morningShift, id: 'shift-4', start_time: '13:00', end_time: '17:00' }

    vi.mocked(shiftRepository.createShift)
      .mockResolvedValueOnce(morningShift)
      .mockResolvedValueOnce(afternoonShift)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({
      id: 'assign-y', shift_id: 'shift-3', user_id: 'emp-2', assigned_by: 'partner-1',
      supervisor_employee_id: null, user_name_snapshot: null, created_at: '2026-08-01T00:00:00.000Z',
    })
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.createSplitShift({
      company_id: 'comp-1',
      department_id: 'dept-1',
      shift_date: '2026-08-10',
      created_by: 'partner-1',
      assigned_user_id: 'emp-2',
      blocks: [
        { start_time: '09:00', end_time: '12:00' },
        { start_time: '13:00', end_time: '17:00' },
      ],
    })

    expect(result).toEqual({ shifts: [morningShift, afternoonShift], warning: null })
    expect(shiftRepository.createShift).toHaveBeenCalledTimes(2)
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledTimes(2)
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith(expect.objectContaining({ shift_id: 'shift-3', user_id: 'emp-2' }))
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith(expect.objectContaining({ shift_id: 'shift-4', user_id: 'emp-2' }))
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })
})
