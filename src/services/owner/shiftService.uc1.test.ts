import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/shiftRepository', () => ({
  shiftRepository: {
    createShift: vi.fn(),
    createShiftAssignment: vi.fn(),
    getAssignmentsByUserAndDateRange: vi.fn(),
    createActionHistory: vi.fn(),
  },
}))

import { shiftService } from './shiftService'
import { shiftRepository } from '@/repositories/owner/shiftRepository'

describe('UC1 Create Shift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC1-M-UT-O: Owner creates a draft shift and assigns it to an Employee', async () => {
    const draftShift = {
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

    vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([])
    vi.mocked(shiftRepository.createShift).mockResolvedValue(draftShift)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({
      id: 'assign-1',
      shift_id: 'shift-1',
      user_id: 'emp-1',
      assigned_by: 'owner-1',
      supervisor_employee_id: null,
      user_name_snapshot: null,
      created_at: '2026-08-01T00:00:00.000Z',
    })
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.createShift({
      company_id: 'comp-1',
      department_id: 'dept-1',
      shift_date: '2026-08-10',
      start_time: '09:00',
      end_time: '17:00',
      created_by: 'owner-1',
      assigned_user_id: 'emp-1',
    })

    expect(result).toEqual({ shift: draftShift, warning: null })
    expect(shiftRepository.createShift).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
      shift_id: 'shift-1',
      user_id: 'emp-1',
      assigned_by: 'owner-1',
      supervisor_employee_id: null,
    })
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })

  it('UC1-M-UT-P: Partner creates a draft shift and assigns it to a Manager', async () => {
    const draftShift = {
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

    vi.mocked(shiftRepository.getAssignmentsByUserAndDateRange).mockResolvedValue([])
    vi.mocked(shiftRepository.createShift).mockResolvedValue(draftShift)
    vi.mocked(shiftRepository.createShiftAssignment).mockResolvedValue({
      id: 'assign-2',
      shift_id: 'shift-2',
      user_id: 'mgr-1',
      assigned_by: 'partner-1',
      supervisor_employee_id: null,
      user_name_snapshot: null,
      created_at: '2026-08-01T00:00:00.000Z',
    })
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.createShift({
      company_id: 'comp-1',
      department_id: 'dept-1',
      shift_date: '2026-08-10',
      start_time: '09:00',
      end_time: '17:00',
      created_by: 'partner-1',
      assigned_user_id: 'mgr-1',
    })

    expect(result).toEqual({ shift: draftShift, warning: null })
    expect(shiftRepository.createShift).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createShiftAssignment).toHaveBeenCalledWith({
      shift_id: 'shift-2',
      user_id: 'mgr-1',
      assigned_by: 'partner-1',
      supervisor_employee_id: null,
    })
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })
})
