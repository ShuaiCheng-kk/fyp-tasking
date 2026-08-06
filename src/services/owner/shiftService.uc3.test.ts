import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/shiftRepository', () => ({
  shiftRepository: {
    getShiftById: vi.fn(),
    getAssignmentsByShiftIds: vi.fn(),
    updateShift: vi.fn(),
    createActionHistory: vi.fn(),
    getAssignmentsByUserAndDateRange: vi.fn(),
    deleteAssignmentsByShiftId: vi.fn(),
    createShiftAssignment: vi.fn(),
  },
}))

import { shiftService } from './shiftService'
import { shiftRepository } from '@/repositories/owner/shiftRepository'

describe('UC3 Edit Shift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC3-M-UT-O: Owner edits the start and end time of an existing shift', async () => {
    const existingShift = {
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
    const updatedShift = { ...existingShift, start_time: '10:00', end_time: '18:00' }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(existingShift)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
    vi.mocked(shiftRepository.updateShift).mockResolvedValue(updatedShift)
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.editShift(
      'shift-1',
      { start_time: '10:00', end_time: '18:00' },
      undefined,
      'owner-1',
    )

    expect(result).toEqual({ shift: updatedShift, warning: null })
    expect(shiftRepository.updateShift).toHaveBeenCalledWith('shift-1', { start_time: '10:00', end_time: '18:00' })
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })

  it('UC3-M-UT-P: Partner reassigns an existing shift to a different Employee', async () => {
    const existingShift = {
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

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(existingShift)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([{
      id: 'assign-old',
      shift_id: 'shift-2',
      user_id: 'emp-1',
      assigned_by: 'partner-1',
      supervisor_employee_id: null,
      user_name_snapshot: null,
      created_at: '2026-08-01T00:00:00.000Z',
    }])
    vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([])
    vi.mocked(shiftRepository.deleteAssignmentsByShiftId).mockResolvedValue(undefined as never)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({
      id: 'assign-new',
      shift_id: 'shift-2',
      user_id: 'emp-2',
      assigned_by: 'partner-1',
      supervisor_employee_id: null,
      user_name_snapshot: null,
      created_at: '2026-08-01T00:00:00.000Z',
    })
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.editShift(
      'shift-2',
      {},
      { assigned_user_id: 'emp-2', assigned_by: 'partner-1' },
      'partner-1',
    )

    expect(result).toEqual({ shift: existingShift, warning: null })
    expect(shiftRepository.deleteAssignmentsByShiftId).toHaveBeenCalledWith('shift-2')
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
      shift_id: 'shift-2',
      user_id: 'emp-2',
      assigned_by: 'partner-1',
      supervisor_employee_id: null,
    })
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })
})
