// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { ShiftSwapDepartmentSettings, ShiftSwapDepartmentSettingsUpsertInput } from '@/types/Attendance'

const SETTINGS_COLUMNS = 'company_id, department_id, auto_approval_enabled, monthly_swap_limit, deadline_hours_before_shift, require_review_on_limit_exceeded, require_review_on_deadline_exceeded, updated_by, updated_at'

export const shiftSwapDepartmentSettingsRepository = {
  async getSettings(company_id: string, department_id: string): Promise<ShiftSwapDepartmentSettings | null> {
    const { data, error } = await supabase
      .from('shift_swap_department_settings')
      .select(SETTINGS_COLUMNS)
      .eq('company_id', company_id)
      .eq('department_id', department_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ShiftSwapDepartmentSettings | null) ?? null
  },

  async getSettingsForDepartments(company_id: string, department_ids: string[]): Promise<ShiftSwapDepartmentSettings[]> {
    if (department_ids.length === 0) return []
    const { data, error } = await supabase
      .from('shift_swap_department_settings')
      .select(SETTINGS_COLUMNS)
      .eq('company_id', company_id)
      .in('department_id', department_ids)
    if (error) throw new Error(error.message)
    return (data as ShiftSwapDepartmentSettings[] | null) ?? []
  },

  async upsertSettings(input: ShiftSwapDepartmentSettingsUpsertInput): Promise<ShiftSwapDepartmentSettings> {
    const { data, error } = await supabase
      .from('shift_swap_department_settings')
      .upsert({
        company_id: input.company_id,
        department_id: input.department_id,
        auto_approval_enabled: input.auto_approval_enabled,
        monthly_swap_limit: input.monthly_swap_limit,
        deadline_hours_before_shift: input.deadline_hours_before_shift,
        require_review_on_limit_exceeded: input.require_review_on_limit_exceeded,
        require_review_on_deadline_exceeded: input.require_review_on_deadline_exceeded,
        updated_by: input.updated_by,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,department_id' })
      .select(SETTINGS_COLUMNS)
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftSwapDepartmentSettings
  },
}
