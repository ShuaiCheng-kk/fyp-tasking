import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/shiftRepository', () => ({
  shiftRepository: {
    getShiftsByCompanyAndDateRange: vi.fn(),
    updateSchedulePublication: vi.fn(),
    createActionHistory: vi.fn(),
  },
}))

import { shiftService } from './shiftService'
import { shiftRepository } from '@/repositories/owner/shiftRepository'

describe('UC5 Publish Schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('UC5-M-UT-O: Owner publishes the draft schedule for a date range', async () => {
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
    const publishedShift = { ...draftShift, publication_status: 'published' as const }

    vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([draftShift])
    vi.mocked(shiftRepository.updateSchedulePublication).mockResolvedValue([publishedShift])
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.publishSchedule({
      company_id: 'comp-1',
      date_from: '2026-08-10',
      date_to: '2026-08-16',
      publication_status: 'published',
      performed_by: 'owner-1',
    })

    expect(result).toEqual({ shifts: [publishedShift] })
    expect(shiftRepository.updateSchedulePublication).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })

  it('UC5-M-UT-P: Partner publishes the draft schedule for a date range', async () => {
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
    const publishedShift = { ...draftShift, publication_status: 'published' as const }

    vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([draftShift])
    vi.mocked(shiftRepository.updateSchedulePublication).mockResolvedValue([publishedShift])
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.publishSchedule({
      company_id: 'comp-1',
      date_from: '2026-08-10',
      date_to: '2026-08-16',
      publication_status: 'published',
      performed_by: 'partner-1',
    })

    expect(result).toEqual({ shifts: [publishedShift] })
    expect(shiftRepository.updateSchedulePublication).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })

  it('UC5-A1-UT-O: Owner unpublishes the schedule for a date range', async () => {
    const publishedShift = {
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
    const draftShift = { ...publishedShift, publication_status: 'draft' as const }

    vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([publishedShift])
    vi.mocked(shiftRepository.updateSchedulePublication).mockResolvedValue([draftShift])
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.publishSchedule({
      company_id: 'comp-1',
      date_from: '2026-08-10',
      date_to: '2026-08-16',
      publication_status: 'draft',
      performed_by: 'owner-1',
    })

    expect(result).toEqual({ shifts: [draftShift] })
    expect(shiftRepository.updateSchedulePublication).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })

  it('UC5-A1-UT-P: Partner unpublishes the schedule for a date range', async () => {
    const publishedShift = {
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
    const draftShift = { ...publishedShift, publication_status: 'draft' as const }

    vi.mocked(shiftRepository.getShiftsByCompanyAndDateRange).mockResolvedValue([publishedShift])
    vi.mocked(shiftRepository.updateSchedulePublication).mockResolvedValue([draftShift])
    vi.mocked(shiftRepository.createActionHistory).mockResolvedValue(undefined as never)

    const result = await shiftService.publishSchedule({
      company_id: 'comp-1',
      date_from: '2026-08-10',
      date_to: '2026-08-16',
      publication_status: 'draft',
      performed_by: 'partner-1',
    })

    expect(result).toEqual({ shifts: [draftShift] })
    expect(shiftRepository.updateSchedulePublication).toHaveBeenCalledTimes(1)
    expect(shiftRepository.createActionHistory).toHaveBeenCalledTimes(1)
  })
})
