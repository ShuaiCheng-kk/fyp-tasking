// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { authRepository } from '@/repositories/auth/authRepository'
import { attendanceRepository } from '@/repositories/owner/attendanceRepository'
import { offDaySettingsRepository } from '@/repositories/owner/offDaySettingsRepository'
import {
  OffDayQuotaSetting,
  OffDayQuotaUpsertInput,
  OffDaySubmissionDeadline,
  OffDaySubmissionDeadlineUpsertInput,
} from '@/types/Attendance'

export const offDaySettingsService = {
  async assertOwner(user_id: string, company_id: string): Promise<void> {
    const user = await authRepository.findByAuthIdOrInternalId(user_id)
    if (!user || user.role !== 'Owner' || user.company_id !== company_id) {
      throw new Error('Only Owner can manage Weekly Day Off settings')
    }
  },

  async getQuotaSettings(company_id: string, owner_id: string): Promise<Array<OffDayQuotaSetting & { manager_name: string | null }>> {
    await this.assertOwner(owner_id, company_id)
    const settings = await offDaySettingsRepository.getQuotaSettings(company_id)
    const managerIds = settings.map(s => s.user_id).filter((id): id is string => !!id)
    const managers = managerIds.length > 0 ? await attendanceRepository.getUsersByIds(managerIds) : []
    const namesById = new Map(managers.map(m => [m.id, m.full_name]))
    return settings.map(s => ({ ...s, manager_name: s.user_id ? namesById.get(s.user_id) ?? null : null }))
  },

  async setCompanyDefaultQuota(input: { company_id: string; owner_id: string; max_days_per_week: number }): Promise<OffDayQuotaSetting> {
    await this.assertOwner(input.owner_id, input.company_id)
    assertValidQuota(input.max_days_per_week)
    const upsertInput: OffDayQuotaUpsertInput = {
      company_id: input.company_id,
      user_id: null,
      max_days_per_week: input.max_days_per_week,
      updated_by: input.owner_id,
    }
    return offDaySettingsRepository.upsertQuotaSetting(upsertInput)
  },

  async setManagerQuotaOverride(input: { company_id: string; owner_id: string; manager_id: string; max_days_per_week: number }): Promise<OffDayQuotaSetting> {
    await this.assertOwner(input.owner_id, input.company_id)
    assertValidQuota(input.max_days_per_week)
    const manager = await authRepository.findByAuthIdOrInternalId(input.manager_id)
    if (!manager || manager.role !== 'Manager' || manager.company_id !== input.company_id) {
      throw new Error('manager_id must resolve to a Manager in this company')
    }
    const upsertInput: OffDayQuotaUpsertInput = {
      company_id: input.company_id,
      user_id: input.manager_id,
      max_days_per_week: input.max_days_per_week,
      updated_by: input.owner_id,
    }
    return offDaySettingsRepository.upsertQuotaSetting(upsertInput)
  },

  async removeManagerQuotaOverride(input: { company_id: string; owner_id: string; manager_id: string }): Promise<void> {
    await this.assertOwner(input.owner_id, input.company_id)
    return offDaySettingsRepository.deleteQuotaOverride(input.company_id, input.manager_id)
  },

  async getEffectiveQuota(company_id: string, user_id: string): Promise<number> {
    const override = await offDaySettingsRepository.getQuotaForUser(company_id, user_id)
    if (override) return override.max_days_per_week
    const fallback = await offDaySettingsRepository.getCompanyDefaultQuota(company_id)
    return fallback?.max_days_per_week ?? 2
  },

  async getDeadline(company_id: string, owner_id: string): Promise<OffDaySubmissionDeadline | null> {
    await this.assertOwner(owner_id, company_id)
    return offDaySettingsRepository.getDeadline(company_id)
  },

  async setDeadline(input: { company_id: string; owner_id: string; deadline_weekday: number }): Promise<OffDaySubmissionDeadline> {
    await this.assertOwner(input.owner_id, input.company_id)
    if (!Number.isInteger(input.deadline_weekday) || input.deadline_weekday < 0 || input.deadline_weekday > 6) {
      throw new Error('deadline_weekday must be an integer between 0 and 6')
    }
    const upsertInput: OffDaySubmissionDeadlineUpsertInput = {
      company_id: input.company_id,
      deadline_weekday: input.deadline_weekday,
      updated_by: input.owner_id,
    }
    return offDaySettingsRepository.upsertDeadline(upsertInput)
  },
}

function assertValidQuota(max_days_per_week: number): void {
  if (!Number.isInteger(max_days_per_week) || max_days_per_week < 1 || max_days_per_week > 7) {
    throw new Error('max_days_per_week must be an integer between 1 and 7')
  }
}
