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

vi.mock('@/repositories/owner/ownerTeamRepository', () => ({
  ownerTeamRepository: {
    findManagerDepartments: vi.fn(),
  },
}))

vi.mock('@/repositories/owner/shiftSwapDepartmentSettingsRepository', () => ({
  shiftSwapDepartmentSettingsRepository: {
    getSettings: vi.fn(),
    getSettingsForDepartments: vi.fn(),
    upsertSettings: vi.fn(),
  },
}))

import { shiftSwapDepartmentSettingsService } from './shiftSwapDepartmentSettingsService'
import { authRepository } from '@/repositories/auth/authRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { shiftSwapDepartmentSettingsRepository } from '@/repositories/owner/shiftSwapDepartmentSettingsRepository'

const manager = { id: 'mgr-1', role: 'Manager', company_id: 'company-1' }
const owner = { id: 'owner-1', role: 'Owner', company_id: 'company-1' }

const validSettingsInput = {
  company_id: 'company-1',
  department_id: 'dept-1',
  manager_id: 'mgr-1',
  auto_approval_enabled: true,
  monthly_swap_limit: 3,
  deadline_hours_before_shift: 12,
  require_review_on_limit_exceeded: true,
  require_review_on_deadline_exceeded: true,
}

describe('shiftSwapDepartmentSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('assertManagerOfDepartment', () => {
    it('passes for a Manager who manages the department', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(manager as any)
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-1', department_name: 'Ops' }])

      await expect(shiftSwapDepartmentSettingsService.assertManagerOfDepartment('mgr-1', 'company-1', 'dept-1')).resolves.toBeUndefined()
    })

    it('rejects a Manager who does not manage that department', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(manager as any)
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-other', department_name: 'Other' }])

      await expect(shiftSwapDepartmentSettingsService.assertManagerOfDepartment('mgr-1', 'company-1', 'dept-1'))
        .rejects.toThrow('do not manage')
    })

    it('rejects a non-Manager caller (e.g. Owner/Partner cannot manage a department\'s own settings)', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(owner as any)

      await expect(shiftSwapDepartmentSettingsService.assertManagerOfDepartment('owner-1', 'company-1', 'dept-1'))
        .rejects.toThrow('Only a Manager')
      expect(ownerTeamRepository.findManagerDepartments).not.toHaveBeenCalled()
    })

    it('rejects a caller from a different company', async () => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue({ ...manager, company_id: 'other-company' } as any)

      await expect(shiftSwapDepartmentSettingsService.assertManagerOfDepartment('mgr-1', 'company-1', 'dept-1'))
        .rejects.toThrow('Only a Manager')
    })
  })

  describe('getSettings', () => {
    beforeEach(() => {
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(manager as any)
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-1', department_name: 'Ops' }])
    })

    it('returns the stored row when one exists', async () => {
      const stored = { company_id: 'company-1', department_id: 'dept-1', auto_approval_enabled: true, monthly_swap_limit: 3, deadline_hours_before_shift: 12, require_review_on_limit_exceeded: true, require_review_on_deadline_exceeded: true, updated_by: 'mgr-1', updated_at: '2026-01-01T00:00:00Z' }
      vi.mocked(shiftSwapDepartmentSettingsRepository.getSettings).mockResolvedValue(stored)

      const result = await shiftSwapDepartmentSettingsService.getSettings('company-1', 'dept-1', 'mgr-1')

      expect(result).toEqual(stored)
    })

    it('returns safe defaults when nothing is configured yet', async () => {
      vi.mocked(shiftSwapDepartmentSettingsRepository.getSettings).mockResolvedValue(null)

      const result = await shiftSwapDepartmentSettingsService.getSettings('company-1', 'dept-1', 'mgr-1')

      expect(result).toEqual(expect.objectContaining({
        company_id: 'company-1',
        department_id: 'dept-1',
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
      vi.mocked(authRepository.findByAuthIdOrInternalId).mockResolvedValue(manager as any)
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-1', department_name: 'Ops' }])
    })

    it('rejects a non-positive monthly_swap_limit', async () => {
      await expect(shiftSwapDepartmentSettingsService.setSettings({ ...validSettingsInput, monthly_swap_limit: 0 }))
        .rejects.toThrow('positive integer')
    })

    it('rejects a non-integer deadline_hours_before_shift', async () => {
      await expect(shiftSwapDepartmentSettingsService.setSettings({ ...validSettingsInput, deadline_hours_before_shift: 1.5 }))
        .rejects.toThrow('positive integer')
    })

    it('rejects a Manager trying to set settings for a department they do not manage', async () => {
      vi.mocked(ownerTeamRepository.findManagerDepartments).mockResolvedValue([{ department_id: 'dept-other', department_name: 'Other' }])

      await expect(shiftSwapDepartmentSettingsService.setSettings(validSettingsInput))
        .rejects.toThrow('do not manage')
      expect(shiftSwapDepartmentSettingsRepository.upsertSettings).not.toHaveBeenCalled()
    })

    it('upserts a valid settings payload scoped to the manager\'s department', async () => {
      vi.mocked(shiftSwapDepartmentSettingsRepository.upsertSettings).mockResolvedValue({ ...validSettingsInput, updated_by: 'mgr-1', updated_at: '2026-01-01T00:00:00Z' } as any)

      await shiftSwapDepartmentSettingsService.setSettings(validSettingsInput)

      expect(shiftSwapDepartmentSettingsRepository.upsertSettings).toHaveBeenCalledWith({
        company_id: 'company-1',
        department_id: 'dept-1',
        auto_approval_enabled: true,
        monthly_swap_limit: 3,
        deadline_hours_before_shift: 12,
        require_review_on_limit_exceeded: true,
        require_review_on_deadline_exceeded: true,
        updated_by: 'mgr-1',
      })
    })
  })
})
