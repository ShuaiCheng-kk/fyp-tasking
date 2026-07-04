import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  createClient: () => ({}),
}))

vi.mock('@/repositories/auth/authRepository', () => ({
  authRepository: {
    findByAuthIdOrInternalId: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/attendanceRepository', () => ({
  attendanceRepository: {
    getUsersByIds: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/offDaySettingsRepository', () => ({
  offDaySettingsRepository: {
    getQuotaSettings: vi.fn(),
    getQuotaForUser: vi.fn(),
    getCompanyDefaultQuota: vi.fn(),
    upsertQuotaSetting: vi.fn(),
    deleteQuotaOverride: vi.fn(),
    getDeadline: vi.fn(),
    upsertDeadline: vi.fn(),
  },
}))

import { offDaySettingsService } from './offDaySettingsService'
import { authRepository } from '@/repositories/auth/authRepository'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { offDaySettingsRepository } from '@/repositories/owner/offDaySettingsRepository'

const owner = { id: 'owner-1', role: 'Owner', company_id: 'company-1' }
const nonOwner = { id: 'mgr-1', role: 'Manager', company_id: 'company-1' }

describe('offDaySettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('assertOwner', () => {
    it('passes for an Owner in the same company', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(owner as any)
      await expect(offDaySettingsService.assertOwner('owner-1', 'company-1')).resolves.toBeUndefined()
    })

    it('rejects a non-Owner caller', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(nonOwner as any)
      await expect(offDaySettingsService.assertOwner('mgr-1', 'company-1')).rejects.toThrow('Only Owner')
    })

    it('rejects a caller from a different company', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({ ...owner, company_id: 'other-company' } as any)
      await expect(offDaySettingsService.assertOwner('owner-1', 'company-1')).rejects.toThrow('Only Owner')
    })
  })

  describe('setDefaultQuota', () => {
    beforeEach(() => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(owner as any)
    })

    it('rejects a non-integer quota', async () => {
      await expect(offDaySettingsService.setDefaultQuota({ company_id: 'company-1', owner_id: 'owner-1', role: 'Manager', max_days_per_week: 2.5 }))
        .rejects.toThrow('integer')
    })

    it('rejects a quota outside 1-7', async () => {
      await expect(offDaySettingsService.setDefaultQuota({ company_id: 'company-1', owner_id: 'owner-1', role: 'Manager', max_days_per_week: 8 }))
        .rejects.toThrow('integer')
    })

    it('upserts with user_id null and the given role for the default', async () => {
      vi.mocked(offDaySettingsRepository.upsertQuotaSetting).mockResolvedValue({ company_id: 'company-1', user_id: null, max_days_per_week: 3, role: 'Manager', updated_by: 'owner-1', updated_at: '2026-01-01' })

      await offDaySettingsService.setDefaultQuota({ company_id: 'company-1', owner_id: 'owner-1', role: 'Manager', max_days_per_week: 3 })

      expect(offDaySettingsRepository.upsertQuotaSetting).toHaveBeenCalledWith({
        company_id: 'company-1', user_id: null, max_days_per_week: 3, role: 'Manager', updated_by: 'owner-1',
      })
    })
  })

  describe('setUserQuotaOverride', () => {
    beforeEach(() => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockImplementation(async (id: string) => {
        if (id === 'owner-1') return owner as any
        if (id === 'mgr-2') return { id: 'mgr-2', role: 'Manager', company_id: 'company-1' } as any
        if (id === 'emp-2') return { id: 'emp-2', role: 'Employee', company_id: 'company-1' } as any
        return null
      })
    })

    it('rejects when user_id does not resolve to a Manager or Employee in this company', async () => {
      await expect(offDaySettingsService.setUserQuotaOverride({ company_id: 'company-1', owner_id: 'owner-1', user_id: 'nobody', max_days_per_week: 2 }))
        .rejects.toThrow('must resolve to a Manager or Employee')
    })

    it('upserts with the manager user_id set', async () => {
      vi.mocked(offDaySettingsRepository.upsertQuotaSetting).mockResolvedValue({ company_id: 'company-1', user_id: 'mgr-2', max_days_per_week: 3, role: null, updated_by: 'owner-1', updated_at: '2026-01-01' })

      await offDaySettingsService.setUserQuotaOverride({ company_id: 'company-1', owner_id: 'owner-1', user_id: 'mgr-2', max_days_per_week: 3 })

      expect(offDaySettingsRepository.upsertQuotaSetting).toHaveBeenCalledWith({
        company_id: 'company-1', user_id: 'mgr-2', max_days_per_week: 3, role: null, updated_by: 'owner-1',
      })
    })

    it('upserts with an Employee user_id set', async () => {
      vi.mocked(offDaySettingsRepository.upsertQuotaSetting).mockResolvedValue({ company_id: 'company-1', user_id: 'emp-2', max_days_per_week: 4, role: null, updated_by: 'owner-1', updated_at: '2026-01-01' })

      await offDaySettingsService.setUserQuotaOverride({ company_id: 'company-1', owner_id: 'owner-1', user_id: 'emp-2', max_days_per_week: 4 })

      expect(offDaySettingsRepository.upsertQuotaSetting).toHaveBeenCalledWith({
        company_id: 'company-1', user_id: 'emp-2', max_days_per_week: 4, role: null, updated_by: 'owner-1',
      })
    })
  })

  describe('getEffectiveQuota', () => {
    it('returns the per-user override when one exists', async () => {
      vi.mocked(offDaySettingsRepository.getQuotaForUser).mockResolvedValue({ company_id: 'company-1', user_id: 'mgr-1', max_days_per_week: 3, role: null, updated_by: null, updated_at: '2026-01-01' })

      const quota = await offDaySettingsService.getEffectiveQuota('company-1', 'mgr-1')

      expect(quota).toBe(3)
      expect(offDaySettingsRepository.getCompanyDefaultQuota).not.toHaveBeenCalled()
    })

    it('falls back to the role-scoped company default when no override exists', async () => {
      vi.mocked(offDaySettingsRepository.getQuotaForUser).mockResolvedValue(null)
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({ id: 'emp-1', role: 'Employee', company_id: 'company-1' } as any)
      vi.mocked(offDaySettingsRepository.getCompanyDefaultQuota).mockResolvedValue({ company_id: 'company-1', user_id: null, max_days_per_week: 2, role: 'Employee', updated_by: null, updated_at: '2026-01-01' })

      const quota = await offDaySettingsService.getEffectiveQuota('company-1', 'emp-1')

      expect(quota).toBe(2)
      expect(offDaySettingsRepository.getCompanyDefaultQuota).toHaveBeenCalledWith('company-1', 'Employee')
    })

    it('falls back to a hardcoded default of 2 when nothing is configured', async () => {
      vi.mocked(offDaySettingsRepository.getQuotaForUser).mockResolvedValue(null)
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({ id: 'emp-1', role: 'Employee', company_id: 'company-1' } as any)
      vi.mocked(offDaySettingsRepository.getCompanyDefaultQuota).mockResolvedValue(null)

      const quota = await offDaySettingsService.getEffectiveQuota('company-1', 'emp-1')

      expect(quota).toBe(2)
    })
  })

  describe('setDeadline', () => {
    beforeEach(() => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(owner as any)
    })

    it('rejects a deadline_weekday outside 0-6', async () => {
      await expect(offDaySettingsService.setDeadline({ company_id: 'company-1', owner_id: 'owner-1', deadline_weekday: 7, deadline_time: '17:00' }))
        .rejects.toThrow('0 and 6')
    })

    it('rejects a deadline_time not in HH:MM 24-hour format', async () => {
      await expect(offDaySettingsService.setDeadline({ company_id: 'company-1', owner_id: 'owner-1', deadline_weekday: 2, deadline_time: '5:00 PM' }))
        .rejects.toThrow('HH:MM')
    })

    it('upserts a valid deadline', async () => {
      vi.mocked(offDaySettingsRepository.upsertDeadline).mockResolvedValue({ company_id: 'company-1', deadline_weekday: 2, deadline_time: '17:00', updated_by: 'owner-1', updated_at: '2026-01-01' })

      await offDaySettingsService.setDeadline({ company_id: 'company-1', owner_id: 'owner-1', deadline_weekday: 2, deadline_time: '17:00' })

      expect(offDaySettingsRepository.upsertDeadline).toHaveBeenCalledWith({
        company_id: 'company-1', deadline_weekday: 2, deadline_time: '17:00', updated_by: 'owner-1',
      })
    })
  })

  describe('getQuotaSettings', () => {
    it('attaches manager_name to override rows via a batch user lookup', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(owner as any)
      vi.mocked(offDaySettingsRepository.getQuotaSettings).mockResolvedValue([
        { company_id: 'company-1', user_id: null, max_days_per_week: 2, role: 'Manager', updated_by: null, updated_at: '2026-01-01' },
        { company_id: 'company-1', user_id: 'mgr-1', max_days_per_week: 3, role: null, updated_by: 'owner-1', updated_at: '2026-01-01' },
      ])
      vi.mocked(attendanceRepository.getUsersByIds).mockResolvedValue([{ id: 'mgr-1', full_name: 'Manager One', role: 'Manager' }] as any)

      const settings = await offDaySettingsService.getQuotaSettings('company-1', 'owner-1')

      expect(settings).toEqual([
        expect.objectContaining({ user_id: null, manager_name: null }),
        expect.objectContaining({ user_id: 'mgr-1', manager_name: 'Manager One' }),
      ])
    })
  })
})
