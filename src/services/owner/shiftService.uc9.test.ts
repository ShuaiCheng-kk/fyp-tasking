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
    createActionHistory: vi.fn(),
  },
}))

import { shiftService } from './shiftService'
import { shiftRepository } from '@/repositories/owner/shiftRepository'

const baseShift = {
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
}

describe('UC9 Bulk Edit Shifts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(shiftRepository.getAssignmentsByShiftIds).mockResolvedValue([])
  })

  it('UC9-M-UT-O: Owner bulk edits the times of multiple shifts at once', async () => {
    const shift1 = { ...baseShift, id: 'shift-1', created_by: 'owner-1' }
    const shift2 = { ...baseShift, id: 'shift-2', created_by: 'owner-1' }

    vi.mocked(shiftRepository.getShiftById).mockImplementation(async (id: string) =>
      id === 'shift-1' ? shift1 : shift2)
    vi.mocked(shiftRepository.updateShift).mockImplementation(async (id: string, fields: any) =>
      ({ ...(id === 'shift-1' ? shift1 : shift2), ...fields }))
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.bulkEditShifts('comp-1', [
      { id: 'shift-1', start_time: '10:00', end_time: '18:00' },
      { id: 'shift-2', start_time: '11:00', end_time: '19:00' },
    ], 'owner-1')

    expect(result.failed).toEqual([])
    expect(result.updated).toEqual([
      { ...shift1, start_time: '10:00', end_time: '18:00' },
      { ...shift2, start_time: '11:00', end_time: '19:00' },
    ])
    expect(shiftRepository.updateShift).toHaveBeenCalledTimes(2)
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })

  it('UC9-M-UT-P: Partner bulk edits the times of multiple shifts at once', async () => {
    const shift1 = { ...baseShift, id: 'shift-3', created_by: 'partner-1' }
    const shift2 = { ...baseShift, id: 'shift-4', created_by: 'partner-1' }

    vi.mocked(shiftRepository.getShiftById).mockImplementation(async (id: string) =>
      id === 'shift-3' ? shift1 : shift2)
    vi.mocked(shiftRepository.updateShift).mockImplementation(async (id: string, fields: any) =>
      ({ ...(id === 'shift-3' ? shift1 : shift2), ...fields }))
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.bulkEditShifts('comp-1', [
      { id: 'shift-3', start_time: '10:00', end_time: '18:00' },
      { id: 'shift-4', start_time: '11:00', end_time: '19:00' },
    ], 'partner-1')

    expect(result.failed).toEqual([])
    expect(result.updated).toEqual([
      { ...shift1, start_time: '10:00', end_time: '18:00' },
      { ...shift2, start_time: '11:00', end_time: '19:00' },
    ])
    expect(shiftRepository.updateShift).toHaveBeenCalledTimes(2)
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })
})
