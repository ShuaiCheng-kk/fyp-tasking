// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { ShiftSwapSettings, ShiftSwapSettingsUpsertInput } from '@/types/Attendance'

const SETTINGS_COLUMNS = 'company_id, auto_approval_enabled, monthly_swap_limit, deadline_hours_before_shift, require_review_on_limit_exceeded, require_review_on_deadline_exceeded, updated_by, updated_at'

export const shiftSwapSettingsRepository = {
  async getSettings(company_id: string): Promise<ShiftSwapSettings | null> {
    const { data, error } = await supabase
      .from('shift_swap_settings')
      .select(SETTINGS_COLUMNS)
      .eq('company_id', company_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ShiftSwapSettings | null) ?? null
  },

  async upsertSettings(input: ShiftSwapSettingsUpsertInput): Promise<ShiftSwapSettings> {
    const { data, error } = await supabase
      .from('shift_swap_settings')
      .upsert({
        company_id: input.company_id,
        auto_approval_enabled: input.auto_approval_enabled,
        monthly_swap_limit: input.monthly_swap_limit,
        deadline_hours_before_shift: input.deadline_hours_before_shift,
        require_review_on_limit_exceeded: input.require_review_on_limit_exceeded,
        require_review_on_deadline_exceeded: input.require_review_on_deadline_exceeded,
        updated_by: input.updated_by,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id' })
      .select(SETTINGS_COLUMNS)
      .single()
    if (error) throw new Error(error.message)
    return data as ShiftSwapSettings
  },
}
