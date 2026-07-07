// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { authRepository } from '@/repositories/auth/authRepository'
import { shiftSwapSettingsRepository } from '@/repositories/owner/shiftSwapSettingsRepository'
import { ShiftSwapSettings, ShiftSwapSettingsUpsertInput } from '@/types/Attendance'

const DEFAULT_SETTINGS: Omit<ShiftSwapSettings, 'company_id' | 'updated_by' | 'updated_at'> = {
  auto_approval_enabled: false,
  monthly_swap_limit: null,
  deadline_weekday: null,
  deadline_time: null,
  require_review_on_limit_exceeded: true,
  require_review_on_deadline_exceeded: true,
}

export const shiftSwapSettingsService = {
  async assertOwner(user_id: string, company_id: string): Promise<void> {
    const user = await authRepository.findByAuthIdOrInternalId(user_id)
    if (!user || user.role !== 'Owner' || user.company_id !== company_id) {
      throw new Error('Only Owner can manage Shift Swap settings')
    }
  },

  async getSettings(company_id: string, owner_id: string): Promise<ShiftSwapSettings> {
    await this.assertOwner(owner_id, company_id)
    const existing = await shiftSwapSettingsRepository.getSettings(company_id)
    if (existing) return existing
    return { company_id, updated_by: null, updated_at: '', ...DEFAULT_SETTINGS }
  },

  async setSettings(input: {
    company_id: string
    owner_id: string
    auto_approval_enabled: boolean
    monthly_swap_limit: number | null
    deadline_weekday: number | null
    deadline_time: string | null
    require_review_on_limit_exceeded: boolean
    require_review_on_deadline_exceeded: boolean
  }): Promise<ShiftSwapSettings> {
    await this.assertOwner(input.owner_id, input.company_id)

    if (input.monthly_swap_limit !== null && (!Number.isInteger(input.monthly_swap_limit) || input.monthly_swap_limit < 1)) {
      throw new Error('monthly_swap_limit must be a positive integer, or null for no limit')
    }
    if ((input.deadline_weekday === null) !== (input.deadline_time === null)) {
      throw new Error('deadline_weekday and deadline_time must be set together')
    }
    if (input.deadline_weekday !== null && (!Number.isInteger(input.deadline_weekday) || input.deadline_weekday < 0 || input.deadline_weekday > 6)) {
      throw new Error('deadline_weekday must be an integer between 0 and 6')
    }
    if (input.deadline_time !== null && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(input.deadline_time)) {
      throw new Error('deadline_time must be in HH:MM 24-hour format')
    }

    const upsertInput: ShiftSwapSettingsUpsertInput = {
      company_id: input.company_id,
      auto_approval_enabled: input.auto_approval_enabled,
      monthly_swap_limit: input.monthly_swap_limit,
      deadline_weekday: input.deadline_weekday,
      deadline_time: input.deadline_time,
      require_review_on_limit_exceeded: input.require_review_on_limit_exceeded,
      require_review_on_deadline_exceeded: input.require_review_on_deadline_exceeded,
      updated_by: input.owner_id,
    }
    return shiftSwapSettingsRepository.upsertSettings(upsertInput)
  },
}
