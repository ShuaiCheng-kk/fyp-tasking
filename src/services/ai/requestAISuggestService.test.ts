import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/services/ai/openAIService', () => ({
  openAIService: { generateStructuredJson: vi.fn() },
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getScheduledHeadcountForDeptDate: vi.fn(),
  },
}))

import { requestAISuggestService } from './requestAISuggestService'
import { openAIService } from '@/services/ai/openAIService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'

const stubSuggestion = {
  recommendation: 'approve' as const,
  confidence: 90,
  reason: 'Staffing is adequate.',
  concerns: [],
  alternatives: [],
}

describe('requestAISuggestService.suggestFixedOffDayGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('flags any_date_would_be_understaffed=true when any requested date would drop the requester role below the minimum', async () => {
    vi.mocked(attendanceRepository.getScheduledHeadcountForDeptDate).mockResolvedValue({ managers: 1, employees: 3 })
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue(stubSuggestion)

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      request_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.any_date_would_be_understaffed).toBe(true)
    expect(call.input.requested_dates[0].scheduled_managers).toBe(1)
  })

  it('does not flag understaffing when headcount stays at or above the minimum on every requested date', async () => {
    vi.mocked(attendanceRepository.getScheduledHeadcountForDeptDate).mockResolvedValue({ managers: 2, employees: 3 })
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue(stubSuggestion)

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      request_dates: ['2026-07-13', '2026-07-15'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.any_date_would_be_understaffed).toBe(false)
    expect(call.input.requested_dates).toHaveLength(2)
  })

  it('flags any_date_would_be_understaffed=true when only one of several requested dates is tight', async () => {
    vi.mocked(attendanceRepository.getScheduledHeadcountForDeptDate).mockImplementation(async (_company, _dept, date: string) => {
      if (date === '2026-07-15') return { managers: 1, employees: 3 }
      return { managers: 2, employees: 3 }
    })
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue(stubSuggestion)

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      request_dates: ['2026-07-13', '2026-07-15'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.any_date_would_be_understaffed).toBe(true)
    const tight = call.input.requested_dates.find((d: any) => d.date === '2026-07-15')
    const ok = call.input.requested_dates.find((d: any) => d.date === '2026-07-13')
    expect(tight.would_be_understaffed).toBe(true)
    expect(ok.would_be_understaffed).toBe(false)
  })

  it('only includes dates in safe_alternative_dates that stay at or above the minimum and are not already requested', async () => {
    // Requested dates: 2026-07-13 (Mon). Department is tight on 2026-07-14 (Tue), fine elsewhere.
    vi.mocked(attendanceRepository.getScheduledHeadcountForDeptDate).mockImplementation(async (_company, _dept, date: string) => {
      if (date === '2026-07-14') return { managers: 1, employees: 3 }
      return { managers: 2, employees: 3 }
    })
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue(stubSuggestion)

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Manager One',
      requester_role: 'Manager',
      request_dates: ['2026-07-13'],
      department_id: 'dept-ops',
      company_id: 'company-1',
      user_id: 'mgr-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.safe_alternative_dates).not.toContain('2026-07-14')
    expect(call.input.safe_alternative_dates).not.toContain('2026-07-13')
  })

  it('returns an empty safe_alternative_dates list when department_id is null', async () => {
    vi.mocked(openAIService.generateStructuredJson).mockResolvedValue(stubSuggestion)

    await requestAISuggestService.suggestFixedOffDayGroup({
      requester_name: 'Employee One',
      requester_role: 'Employee',
      request_dates: ['2026-07-13'],
      department_id: null,
      company_id: 'company-1',
      user_id: 'emp-1',
    })

    const call = vi.mocked(openAIService.generateStructuredJson).mock.calls[0][0] as any
    expect(call.input.safe_alternative_dates).toEqual([])
    expect(attendanceRepository.getScheduledHeadcountForDeptDate).not.toHaveBeenCalled()
  })
})
