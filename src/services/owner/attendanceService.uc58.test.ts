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
    getFixedOffDayRequestById: vi.fn(),
    updateFixedOffDayRequest: vi.fn(),
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

function pendingRequest() {
  return {
    id: 'off-1', user_id: 'req-1', company_id: 'comp-1', requested_date: '2026-08-11',
    requested_week: '2026-08-10', status: 'pending', source: 'submitted', reviewed_by: null, reviewed_at: null,
  }
}

describe('UC58 Approve Day Off Request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue(null)
    vi.mocked(attendanceRepository.updateFixedOffDayRequest).mockImplementation(async (id, fields) => ({ id, ...fields } as never))
  })

  it('UC58-M-UT-O: Owner approves a pending day off request as submitted', async () => {
    vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue(pendingRequest() as never)

    const result = await attendanceService.decideFixedOffDayRequest({ id: 'off-1', decision: 'approved', reviewer_id: 'owner-1' })

    expect(result).toMatchObject({ status: 'approved', reviewed_by: 'owner-1' })
  })

  it('UC58-M-UT-P: Partner approves a pending day off request as submitted', async () => {
    vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue(pendingRequest() as never)

    const result = await attendanceService.decideFixedOffDayRequest({ id: 'off-1', decision: 'approved', reviewer_id: 'partner-1' })

    expect(result).toMatchObject({ status: 'approved', reviewed_by: 'partner-1' })
  })

  it('UC58-BR-UT-O-1: Owner cannot reject a day off request outright, since only Approve or Modify are valid decisions', async () => {
    vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue(pendingRequest() as never)

    await expect(attendanceService.decideFixedOffDayRequest({ id: 'off-1', decision: 'rejected' as never, reviewer_id: 'owner-1' }))
      .rejects.toThrow('Invalid request decision')
  })

  it('UC58-BR-UT-P-1: Partner cannot reject a day off request outright, since only Approve or Modify are valid decisions', async () => {
    vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue(pendingRequest() as never)

    await expect(attendanceService.decideFixedOffDayRequest({ id: 'off-1', decision: 'rejected' as never, reviewer_id: 'partner-1' }))
      .rejects.toThrow('Invalid request decision')
  })

  it('UC58-BR-UT-O-2: Owner cannot decide a request that was already auto-assigned and approved', async () => {
    vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({ ...pendingRequest(), source: 'auto_assigned', status: 'approved' } as never)

    await expect(attendanceService.decideFixedOffDayRequest({ id: 'off-1', decision: 'approved', reviewer_id: 'owner-1' }))
      .rejects.toThrow('This day off was auto-assigned and is already approved — nothing to decide')
  })

  it('UC58-BR-UT-P-2: Partner cannot decide a request that was already auto-assigned and approved', async () => {
    vi.mocked(attendanceRepository.getFixedOffDayRequestById).mockResolvedValue({ ...pendingRequest(), source: 'auto_assigned', status: 'approved' } as never)

    await expect(attendanceService.decideFixedOffDayRequest({ id: 'off-1', decision: 'approved', reviewer_id: 'partner-1' }))
      .rejects.toThrow('This day off was auto-assigned and is already approved — nothing to decide')
  })
})
