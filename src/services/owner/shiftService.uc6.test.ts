import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/shiftRepository', () => ({
  shiftRepository: {
    getShiftById: vi.fn(),
    getAssignmentsByShiftIds: vi.fn(),
    getAssignmentsByUserAndDateRange: vi.fn(),
    createShift: vi.fn(),
    createShiftAssignment: vi.fn(),
    createActionHistory: vi.fn(),
  },
}))

import { shiftService } from './shiftService'
import { shiftRepository } from '@/repositories/owner/shiftRepository'

describe('UC6 Duplicate Shift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC6-M-UT-O: Owner duplicates an existing shift to a new date and Employee', async () => {
    const originalShift = {
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
    const duplicatedShift = { ...originalShift, id: 'shift-5', shift_date: '2026-08-11', template_id: null }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(originalShift)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([{
      id: 'assign-1',
      shift_id: 'shift-1',
      user_id: 'emp-1',
      assigned_by: 'owner-1',
      supervisor_employee_id: null,
      user_name_snapshot: null,
      created_at: '2026-08-01T00:00:00.000Z',
    }])
    vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([])
    vi.mocked(shiftRepository.createShift).mockResolvedValue(duplicatedShift)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({
      id: 'assign-5',
      shift_id: 'shift-5',
      user_id: 'emp-2',
      assigned_by: 'owner-1',
      supervisor_employee_id: null,
      user_name_snapshot: null,
      created_at: '2026-08-01T00:00:00.000Z',
    })
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.duplicateShift('shift-1', {
      shift_date: '2026-08-11',
      start_time: '09:00',
      end_time: '17:00',
      created_by: 'owner-1',
      assigned_user_id: 'emp-2',
    })

    expect(result).toEqual({ shift: duplicatedShift, warning: null })
    expect(shiftRepository.createShift).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
      shift_id: 'shift-5',
      user_id: 'emp-2',
      assigned_by: 'owner-1',
      supervisor_employee_id: null,
    })
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })

  it('UC6-M-UT-P: Partner duplicates an existing shift to a new date and Employee', async () => {
    const originalShift = {
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
    const duplicatedShift = { ...originalShift, id: 'shift-6', shift_date: '2026-08-11', template_id: null }

    vi.mocked(shiftRepository.getShiftById).mockResolvedValue(originalShift)
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([{
      id: 'assign-2',
      shift_id: 'shift-2',
      user_id: 'emp-3',
      assigned_by: 'partner-1',
      supervisor_employee_id: null,
      user_name_snapshot: null,
      created_at: '2026-08-01T00:00:00.000Z',
    }])
    vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([])
    vi.mocked(shiftRepository.createShift).mockResolvedValue(duplicatedShift)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({
      id: 'assign-6',
      shift_id: 'shift-6',
      user_id: 'emp-4',
      assigned_by: 'partner-1',
      supervisor_employee_id: null,
      user_name_snapshot: null,
      created_at: '2026-08-01T00:00:00.000Z',
    })
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.duplicateShift('shift-2', {
      shift_date: '2026-08-11',
      start_time: '09:00',
      end_time: '17:00',
      created_by: 'partner-1',
      assigned_user_id: 'emp-4',
    })

    expect(result).toEqual({ shift: duplicatedShift, warning: null })
    expect(shiftRepository.createShift).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
      shift_id: 'shift-6',
      user_id: 'emp-4',
      assigned_by: 'partner-1',
      supervisor_employee_id: null,
    })
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })
})
