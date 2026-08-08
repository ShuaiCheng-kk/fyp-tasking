import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getFixedOffDayRequestsByIds: vi.fn(),
    decideFixedOffDayRequestGroupAtomic: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/offDaySettingsRepository', () => ({
  offDaySettingsRepository: {
    getDeadline: vi.fn(),
  },
}))

import { attendanceService } from './attendanceService'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { offDaySettingsRepository } from '@/repositories/owner/offDaySettingsRepository'

function weeklyRows() {
  return [
    { id: 'off-1', user_id: 'req-1', company_id: 'comp-1', requested_date: '2026-08-11', requested_week: '2026-08-10', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null },
    { id: 'off-2', user_id: 'req-1', company_id: 'comp-1', requested_date: '2026-08-12', requested_week: '2026-08-10', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null },
  ]
}

describe('UC59 Modify Day Off Request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue(null)
    vi.mocked(attendanceRepository.getFixedOffDayRequestsByIds).mockResolvedValue(weeklyRows() as never)
    vi.mocked(attendanceRepository.decideFixedOffDayRequestGroupAtomic).mockImplementation(async (input) =>
      input.ids.map((id, i) => ({ id, status: input.statuses[i], requested_date: input.requested_dates[i] })) as never)
  })

  it('UC59-M-UT-O: Owner replaces a pending weekly submission with a different set of dates', async () => {
    const result = await attendanceService.decideFixedOffDayRequestGroup({
      ids: ['off-1', 'off-2'], decision: 'modified', reviewer_id: 'owner-1', new_dates: ['2026-08-13', '2026-08-14'],
    })

    expect(result).toEqual([
      { id: 'off-1', status: 'modified', requested_date: '2026-08-13' },
      { id: 'off-2', status: 'modified', requested_date: '2026-08-14' },
    ])
  })

  it('UC59-M-UT-P: Partner replaces a pending weekly submission with a different set of dates', async () => {
    const result = await attendanceService.decideFixedOffDayRequestGroup({
      ids: ['off-1', 'off-2'], decision: 'modified', reviewer_id: 'partner-1', new_dates: ['2026-08-13', '2026-08-14'],
    })

    expect(result).toEqual([
      { id: 'off-1', status: 'modified', requested_date: '2026-08-13' },
      { id: 'off-2', status: 'modified', requested_date: '2026-08-14' },
    ])
  })

  it('UC59-A1-UT-O: Owner picking the exact same dates the request already had is treated as approved rather than modified', async () => {
    const result = await attendanceService.decideFixedOffDayRequestGroup({
      ids: ['off-1', 'off-2'], decision: 'modified', reviewer_id: 'owner-1', new_dates: ['2026-08-11', '2026-08-12'],
    })

    expect(result).toEqual([
      { id: 'off-1', status: 'approved', requested_date: null },
      { id: 'off-2', status: 'approved', requested_date: null },
    ])
  })

  it('UC59-A1-UT-P: Partner picking the exact same dates the request already had is treated as approved rather than modified', async () => {
    const result = await attendanceService.decideFixedOffDayRequestGroup({
      ids: ['off-1', 'off-2'], decision: 'modified', reviewer_id: 'partner-1', new_dates: ['2026-08-11', '2026-08-12'],
    })

    expect(result).toEqual([
      { id: 'off-1', status: 'approved', requested_date: null },
      { id: 'off-2', status: 'approved', requested_date: null },
    ])
  })

  it('UC59-BR-UT-O-1: Owner is blocked when the replacement dates do not map 1:1 to the original rows', async () => {
    await expect(attendanceService.decideFixedOffDayRequestGroup({
      ids: ['off-1', 'off-2'], decision: 'modified', reviewer_id: 'owner-1', new_dates: ['2026-08-13'],
    })).rejects.toThrow('new_dates must match ids 1:1')
  })

  it('UC59-BR-UT-P-1: Partner is blocked when the replacement dates do not map 1:1 to the original rows', async () => {
    await expect(attendanceService.decideFixedOffDayRequestGroup({
      ids: ['off-1', 'off-2'], decision: 'modified', reviewer_id: 'partner-1', new_dates: ['2026-08-13'],
    })).rejects.toThrow('new_dates must match ids 1:1')
  })

  it('UC59-BR-UT-O-2: Owner is blocked when the same replacement date is used more than once in the batch', async () => {
    await expect(attendanceService.decideFixedOffDayRequestGroup({
      ids: ['off-1', 'off-2'], decision: 'modified', reviewer_id: 'owner-1', new_dates: ['2026-08-13', '2026-08-13'],
    })).rejects.toThrow('new_dates must not repeat a date')
  })

  it('UC59-BR-UT-P-2: Partner is blocked when the same replacement date is used more than once in the batch', async () => {
    await expect(attendanceService.decideFixedOffDayRequestGroup({
      ids: ['off-1', 'off-2'], decision: 'modified', reviewer_id: 'partner-1', new_dates: ['2026-08-13', '2026-08-13'],
    })).rejects.toThrow('new_dates must not repeat a date')
  })
})
