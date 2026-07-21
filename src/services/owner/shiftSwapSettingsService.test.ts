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

vi.mock('@/repositories/owner/shiftSwapSettingsRepository', () => ({
  shiftSwapSettingsRepository: {
    getSettings: vi.fn(),
    upsertSettings: vi.fn(),
  },
}))

import { shiftSwapSettingsService } from './shiftSwapSettingsService'
import { authRepository } from '@/repositories/auth/authRepository'
import { shiftSwapSettingsRepository } from '@/repositories/owner/shiftSwapSettingsRepository'

const owner = { id: 'owner-1', role: 'Owner', company_id: 'company-1' }
const nonOwner = { id: 'mgr-1', role: 'Manager', company_id: 'company-1' }

const validSettingsInput = {
  company_id: 'company-1',
  owner_id: 'owner-1',
  auto_approval_enabled: true,
  monthly_swap_limit: 3,
  deadline_hours_before_shift: 12,
  require_review_on_limit_exceeded: true,
  require_review_on_deadline_exceeded: true,
}

describe('shiftSwapSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('assertOwner', () => {
    it('passes for an Owner in the same company', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(owner as any)
      await expect(shiftSwapSettingsService.assertOwner('owner-1', 'company-1')).resolves.toBeUndefined()
    })

    it('passes for a Partner in the same company', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({ id: 'partner-1', role: 'Partner', company_id: 'company-1' } as any)
      await expect(shiftSwapSettingsService.assertOwner('partner-1', 'company-1')).resolves.toBeUndefined()
    })

    it('rejects a non-Owner caller', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(nonOwner as any)
      await expect(shiftSwapSettingsService.assertOwner('mgr-1', 'company-1')).rejects.toThrow('Only Owner')
    })

    it('rejects a caller from a different company', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({ ...owner, company_id: 'other-company' } as any)
      await expect(shiftSwapSettingsService.assertOwner('owner-1', 'company-1')).rejects.toThrow('Only Owner')
    })
  })

  describe('getSettings', () => {
    beforeEach(() => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(owner as any)
    })

    it('returns the stored row when one exists', async () => {
      const stored = { company_id: 'company-1', auto_approval_enabled: true, monthly_swap_limit: 3, deadline_hours_before_shift: 12, require_review_on_limit_exceeded: true, require_review_on_deadline_exceeded: true, updated_by: 'owner-1', updated_at: '2026-01-01T00:00:00Z' }
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue(stored)

      const result = await shiftSwapSettingsService.getSettings('company-1', 'owner-1')

      expect(result).toEqual(stored)
    })

    it('returns safe defaults (auto-approval off, no limit, no deadline) when nothing is configured yet', async () => {
      vi.mocked(shiftSwapSettingsRepository.getSettings).mockResolvedValue(null)

      const result = await shiftSwapSettingsService.getSettings('company-1', 'owner-1')

      expect(result).toEqual(expect.objectContaining({
        company_id: 'company-1',
        auto_approval_enabled: false,
        monthly_swap_limit: null,
        deadline_hours_before_shift: null,
        require_review_on_limit_exceeded: true,
        require_review_on_deadline_exceeded: true,
      }))
    })
  })

  describe('setSettings', () => {
    beforeEach(() => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(owner as any)
    })

    it('rejects a non-positive monthly_swap_limit', async () => {
      await expect(shiftSwapSettingsService.setSettings({ ...validSettingsInput, monthly_swap_limit: 0 }))
        .rejects.toThrow('positive integer')
    })

    it('rejects a non-integer monthly_swap_limit', async () => {
      await expect(shiftSwapSettingsService.setSettings({ ...validSettingsInput, monthly_swap_limit: 2.5 }))
        .rejects.toThrow('positive integer')
    })

    it('allows a null monthly_swap_limit (unlimited)', async () => {
      vi.mocked(shiftSwapSettingsRepository.upsertSettings).mockResolvedValue({ ...validSettingsInput, monthly_swap_limit: null, updated_by: 'owner-1', updated_at: '2026-01-01T00:00:00Z' })
      await expect(shiftSwapSettingsService.setSettings({ ...validSettingsInput, monthly_swap_limit: null })).resolves.toBeDefined()
    })

    it('rejects a non-positive deadline_hours_before_shift', async () => {
      await expect(shiftSwapSettingsService.setSettings({ ...validSettingsInput, deadline_hours_before_shift: 0 }))
        .rejects.toThrow('positive integer')
    })

    it('rejects a non-integer deadline_hours_before_shift', async () => {
      await expect(shiftSwapSettingsService.setSettings({ ...validSettingsInput, deadline_hours_before_shift: 1.5 }))
        .rejects.toThrow('positive integer')
    })

    it('allows a null deadline_hours_before_shift (no deadline)', async () => {
      vi.mocked(shiftSwapSettingsRepository.upsertSettings).mockResolvedValue({ ...validSettingsInput, deadline_hours_before_shift: null, updated_by: 'owner-1', updated_at: '2026-01-01T00:00:00Z' })
      await expect(shiftSwapSettingsService.setSettings({ ...validSettingsInput, deadline_hours_before_shift: null })).resolves.toBeDefined()
    })

    it('upserts a valid settings payload', async () => {
      vi.mocked(shiftSwapSettingsRepository.upsertSettings).mockResolvedValue({ ...validSettingsInput, updated_by: 'owner-1', updated_at: '2026-01-01T00:00:00Z' })

      await shiftSwapSettingsService.setSettings(validSettingsInput)

      expect(shiftSwapSettingsRepository.upsertSettings).toHaveBeenCalledWith({
        company_id: 'company-1',
        auto_approval_enabled: true,
        monthly_swap_limit: 3,
        deadline_hours_before_shift: 12,
        require_review_on_limit_exceeded: true,
        require_review_on_deadline_exceeded: true,
        updated_by: 'owner-1',
      })
    })
  })
})
