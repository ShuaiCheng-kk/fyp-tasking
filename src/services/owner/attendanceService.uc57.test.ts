import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({}),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByAuthIdOrInternalId: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/offDaySettingsRepository', () => ({
  offDaySettingsRepository: {
    getDeadline: vi.fn(),
    getQuotaForUser: vi.fn(),
    getCompanyDefaultQuota: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getFixedOffDayRequestsByUserAndWeek: vi.fn(),
    getShiftDatesForUserWithinDates: vi.fn(),
    deleteFixedOffDayRequestsByUserAndWeek: vi.fn(),
    createFixedOffDayRequests: vi.fn(),
  },
}))

import { attendanceService } from './attendanceService'
import { authRepository } from '@/repositories/auth/authRepository'
import { offDaySettingsRepository } from '@/repositories/owner/offDaySettingsRepository'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'

// 5 August 2026 (Wednesday) — the currently open submission week (no deadline configured, so it's
// always "next week") is the Monday-to-Sunday week starting 10 August 2026.
vi.setSystemTime(new Date('2026-08-05T12:00:00.000Z'))

function requester(role: 'Manager' | 'Employee') {
  return { id: 'req-1', company_id: 'comp-1', role }
}

describe('UC57 Submit Day Off Request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(offDaySettingsRepository.getDeadline).mockResolvedValue(null)
    vi.mocked(offDaySettingsRepository.getQuotaForUser).mockResolvedValue(null)
    vi.mocked(offDaySettingsRepository.getCompanyDefaultQuota).mockResolvedValue(null)
    vi.mocked(attendanceRepository.getFixedOffDayRequestsByUserAndWeek).mockResolvedValue([])
    vi.mocked(attendanceRepository.getShiftDatesForUserWithinDates).mockResolvedValue([])
    vi.mocked(attendanceRepository.deleteFixedOffDayRequestsByUserAndWeek).mockResolvedValue(undefined as never)
    vi.mocked(attendanceRepository.createFixedOffDayRequests).mockImplementation(async (input) => ({ ...input, status: 'pending' } as never))
  })

  it('UC57-M-UT-M: Manager submits exactly their weekly quota of dates within the currently open week', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(requester('Manager') as never)

    const result = await attendanceService.submitFixedOffDayRequest({ user_id: 'req-1', company_id: 'comp-1', dates: ['2026-08-11', '2026-08-12'] })

    expect(result).toMatchObject({ status: 'pending', requested_week: '2026-08-10' })
  })

  it('UC57-M-UT-E: Employee submits exactly their weekly quota of dates within the currently open week', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(requester('Employee') as never)

    const result = await attendanceService.submitFixedOffDayRequest({ user_id: 'req-1', company_id: 'comp-1', dates: ['2026-08-11', '2026-08-12'] })

    expect(result).toMatchObject({ status: 'pending', requested_week: '2026-08-10' })
  })

  it('UC57-A1-UT-M: Manager is blocked from requesting off a date they are already scheduled to work', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(requester('Manager') as never)
    vi.mocked(attendanceRepository.getShiftDatesForUserWithinDates).mockResolvedValue(['2026-08-11'])

    await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'req-1', company_id: 'comp-1', dates: ['2026-08-11', '2026-08-12'] }))
      .rejects.toThrow("You already have a shift scheduled on 2026-08-11 — that date can't be requested off")
  })

  it('UC57-A1-UT-E: Employee is blocked from requesting off a date they are already scheduled to work', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(requester('Employee') as never)
    vi.mocked(attendanceRepository.getShiftDatesForUserWithinDates).mockResolvedValue(['2026-08-11'])

    await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'req-1', company_id: 'comp-1', dates: ['2026-08-11', '2026-08-12'] }))
      .rejects.toThrow("You already have a shift scheduled on 2026-08-11 — that date can't be requested off")
  })

  it('UC57-A2-UT-M: Manager is blocked from submitting again for a week they already have a pending request for', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(requester('Manager') as never)
    vi.mocked(attendanceRepository.getFixedOffDayRequestsByUserAndWeek).mockResolvedValue([{ status: 'pending' }] as never)

    await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'req-1', company_id: 'comp-1', dates: ['2026-08-11', '2026-08-12'] }))
      .rejects.toThrow('You already submitted an Off Day request for the currently open week')
  })

  it('UC57-A2-UT-E: Employee is blocked from submitting again for a week that has already been reviewed', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(requester('Employee') as never)
    vi.mocked(attendanceRepository.getFixedOffDayRequestsByUserAndWeek).mockResolvedValue([{ status: 'approved' }] as never)

    await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'req-1', company_id: 'comp-1', dates: ['2026-08-11', '2026-08-12'] }))
      .rejects.toThrow('This week has already been reviewed and cannot be submitted again')
  })

  it('UC57-BR-UT-M: Manager is blocked from submitting a number of dates that does not match their weekly quota', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(requester('Manager') as never)

    await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'req-1', company_id: 'comp-1', dates: ['2026-08-11'] }))
      .rejects.toThrow('You must select exactly 2 day(s) off per week')
  })

  it('UC57-BR-UT-E: Employee is blocked from submitting dates that span more than one week', async () => {
    vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(requester('Employee') as never)

    await expect(attendanceService.submitFixedOffDayRequest({ user_id: 'req-1', company_id: 'comp-1', dates: ['2026-08-11', '2026-08-18'] }))
      .rejects.toThrow('All dates must fall within the same week')
  })
})
