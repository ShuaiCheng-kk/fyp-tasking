// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { authRepository } from '@/repositories/auth/authRepository'
import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { shiftSwapDepartmentSettingsRepository } from '@/repositories/owner/shiftSwapDepartmentSettingsRepository'
import { ShiftSwapDepartmentSettings, ShiftSwapDepartmentSettingsUpsertInput } from '@/types/Attendance'

const DEFAULT_SETTINGS: Omit<ShiftSwapDepartmentSettings, 'company_id' | 'department_id' | 'updated_by' | 'updated_at'> = {
  auto_approval_enabled: false,
  monthly_swap_limit: null,
  deadline_hours_before_shift: null,
  require_review_on_limit_exceeded: true,
  require_review_on_deadline_exceeded: true,
}

export const shiftSwapDepartmentSettingsService = {
  // Governs Employee<->Employee swaps within one department — only that department's Manager
  // may manage it, and only for a department they actually manage.
  async assertManagerOfDepartment(manager_id: string, company_id: string, department_id: string): Promise<void> {
    const user = await authRepository.findByAuthIdOrInternalId(manager_id)
    if (!user || user.role !== 'Manager' || user.company_id !== company_id) {
      throw new Error('Only a Manager can manage their department\'s Shift Swap settings')
    }
    const managedDepartments = await ownerTeamRepository.findManagerDepartments(user.id, company_id)
    if (!managedDepartments.some(d => d.department_id === department_id)) {
      throw new Error('You do not manage this department')
    }
  },

  async getSettings(company_id: string, department_id: string, manager_id: string): Promise<ShiftSwapDepartmentSettings> {
    await this.assertManagerOfDepartment(manager_id, company_id, department_id)
    const existing = await shiftSwapDepartmentSettingsRepository.getSettings(company_id, department_id)
    if (existing) return existing
    return { company_id, department_id, updated_by: null, updated_at: '', ...DEFAULT_SETTINGS }
  },

  async setSettings(input: {
    company_id: string
    department_id: string
    manager_id: string
    auto_approval_enabled: boolean
    monthly_swap_limit: number | null
    deadline_hours_before_shift: number | null
    require_review_on_limit_exceeded: boolean
    require_review_on_deadline_exceeded: boolean
  }): Promise<ShiftSwapDepartmentSettings> {
    await this.assertManagerOfDepartment(input.manager_id, input.company_id, input.department_id)

    if (input.monthly_swap_limit !== null && (!Number.isInteger(input.monthly_swap_limit) || input.monthly_swap_limit < 1)) {
      throw new Error('monthly_swap_limit must be a positive integer, or null for no limit')
    }
    if (input.deadline_hours_before_shift !== null && (!Number.isInteger(input.deadline_hours_before_shift) || input.deadline_hours_before_shift < 1)) {
      throw new Error('deadline_hours_before_shift must be a positive integer, or null for no deadline')
    }

    const upsertInput: ShiftSwapDepartmentSettingsUpsertInput = {
      company_id: input.company_id,
      department_id: input.department_id,
      auto_approval_enabled: input.auto_approval_enabled,
      monthly_swap_limit: input.monthly_swap_limit,
      deadline_hours_before_shift: input.deadline_hours_before_shift,
      require_review_on_limit_exceeded: input.require_review_on_limit_exceeded,
      require_review_on_deadline_exceeded: input.require_review_on_deadline_exceeded,
      updated_by: input.manager_id,
    }
    return shiftSwapDepartmentSettingsRepository.upsertSettings(upsertInput)
  },
}
