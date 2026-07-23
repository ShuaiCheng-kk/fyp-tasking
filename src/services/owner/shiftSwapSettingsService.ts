// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { authRepository } from '@/repositories/auth/authRepository'
import { shiftSwapSettingsRepository } from '@/repositories/owner/shiftSwapSettingsRepository'
import { ShiftSwapSettings, ShiftSwapSettingsUpsertInput } from '@/types/Attendance'

const DEFAULT_SETTINGS: Omit<ShiftSwapSettings, 'company_id' | 'updated_by' | 'updated_at'> = {
  auto_approval_enabled: false,
  monthly_swap_limit: null,
  deadline_hours_before_shift: null,
  require_review_on_limit_exceeded: true,
  require_review_on_deadline_exceeded: true,
}

export const shiftSwapSettingsService = {
  async assertOwner(user_id: string, company_id: string): Promise<void> {
    const user = await authRepository.findByAuthIdOrInternalId(user_id)
    if (!user || (user.role !== 'Owner' && user.role !== 'Partner') || user.company_id !== company_id) {
      throw new Error('Only Owner or Partner can manage Shift Swap settings')
    }
  },

  // Read-only — a Manager submitting their own swap request needs to see the Owner/Partner-
  // configured deadline (Submit Request modal subtitle), so this only checks company membership,
  // not role. Mutating the settings still goes through assertOwner via setSettings below.
  async assertSameCompany(user_id: string, company_id: string): Promise<void> {
    const user = await authRepository.findByAuthIdOrInternalId(user_id)
    if (!user || user.company_id !== company_id) {
      throw new Error('User not found in this company')
    }
  },

  async getSettings(company_id: string, requester_id: string): Promise<ShiftSwapSettings> {
    await this.assertSameCompany(requester_id, company_id)
    const existing = await shiftSwapSettingsRepository.getSettings(company_id)
    if (existing) return existing
    return { company_id, updated_by: null, updated_at: '', ...DEFAULT_SETTINGS }
  },

  async setSettings(input: {
    company_id: string
    owner_id: string
    auto_approval_enabled: boolean
    monthly_swap_limit: number | null
    deadline_hours_before_shift: number | null
    require_review_on_limit_exceeded: boolean
    require_review_on_deadline_exceeded: boolean
  }): Promise<ShiftSwapSettings> {
    await this.assertOwner(input.owner_id, input.company_id)

    if (input.monthly_swap_limit !== null && (!Number.isInteger(input.monthly_swap_limit) || input.monthly_swap_limit < 1)) {
      throw new Error('monthly_swap_limit must be a positive integer, or null for no limit')
    }
    if (input.deadline_hours_before_shift !== null && (!Number.isInteger(input.deadline_hours_before_shift) || input.deadline_hours_before_shift < 1)) {
      throw new Error('deadline_hours_before_shift must be a positive integer, or null for no deadline')
    }

    const upsertInput: ShiftSwapSettingsUpsertInput = {
      company_id: input.company_id,
      auto_approval_enabled: input.auto_approval_enabled,
      monthly_swap_limit: input.monthly_swap_limit,
      deadline_hours_before_shift: input.deadline_hours_before_shift,
      require_review_on_limit_exceeded: input.require_review_on_limit_exceeded,
      require_review_on_deadline_exceeded: input.require_review_on_deadline_exceeded,
      updated_by: input.owner_id,
    }
    return shiftSwapSettingsRepository.upsertSettings(upsertInput)
  },
}
