// LAYER: Repository
// RULE: Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { OffDayQuotaDefaultRole, OffDayQuotaSetting, OffDayQuotaUpsertInput, OffDaySubmissionDeadline, OffDaySubmissionDeadlineUpsertInput } from '@/types/Attendance'

const QUOTA_SETTING_COLUMNS = 'company_id, user_id, max_days_per_week, role'

export const offDaySettingsRepository = {
  async getQuotaSettings(company_id: string): Promise<OffDayQuotaSetting[]> {
    const { data, error } = await supabase
      .from('off_day_quota_settings')
      .select(QUOTA_SETTING_COLUMNS)
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? []) as OffDayQuotaSetting[]
  },

  async getQuotaForUser(company_id: string, user_id: string): Promise<OffDayQuotaSetting | null> {
    const { data, error } = await supabase
      .from('off_day_quota_settings')
      .select(QUOTA_SETTING_COLUMNS)
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as OffDayQuotaSetting | null) ?? null
  },

  async getCompanyDefaultQuota(company_id: string, role: OffDayQuotaDefaultRole): Promise<OffDayQuotaSetting | null> {
    const { data, error } = await supabase
      .from('off_day_quota_settings')
      .select(QUOTA_SETTING_COLUMNS)
      .eq('company_id', company_id)
      .is('user_id', null)
      .eq('role', role)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as OffDayQuotaSetting | null) ?? null
  },

  async upsertQuotaSetting(input: OffDayQuotaUpsertInput): Promise<OffDayQuotaSetting> {
    // Supabase upsert onConflict can't target a partial unique index by column list alone when
    // user_id is null (partial index "where user_id is null" vs. composite index) — resolve the
    // existing row id first (if any) and update/insert explicitly instead of relying on upsert.
    // For default rows (user_id null), role also disambiguates which default (Manager/Employee).
    let query = supabase
      .from('off_day_quota_settings')
      .select('id')
      .eq('company_id', input.company_id)
    query = input.user_id === null ? query.is('user_id', null).eq('role', input.role as string) : query.eq('user_id', input.user_id)
    const { data: existing, error: findError } = await query.maybeSingle()
    if (findError) throw new Error(findError.message)

    if (existing) {
      const { data, error } = await supabase
        .from('off_day_quota_settings')
        .update({
          max_days_per_week: input.max_days_per_week,
        })
        .eq('id', (existing as { id: string }).id)
        .select(QUOTA_SETTING_COLUMNS)
        .single()
      if (error) throw new Error(error.message)
      return data as OffDayQuotaSetting
    }

    const { data, error } = await supabase
      .from('off_day_quota_settings')
      .insert({
        company_id: input.company_id,
        user_id: input.user_id,
        max_days_per_week: input.max_days_per_week,
        role: input.role,
      })
      .select(QUOTA_SETTING_COLUMNS)
      .single()
    if (error) throw new Error(error.message)
    return data as OffDayQuotaSetting
  },

  async deleteQuotaOverride(company_id: string, user_id: string): Promise<void> {
    const { error } = await supabase
      .from('off_day_quota_settings')
      .delete()
      .eq('company_id', company_id)
      .eq('user_id', user_id)
    if (error) throw new Error(error.message)
  },

  async getDeadline(company_id: string): Promise<OffDaySubmissionDeadline | null> {
    const { data, error } = await supabase
      .from('off_day_submission_deadline')
      .select('company_id, deadline_weekday, deadline_time')
      .eq('company_id', company_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as OffDaySubmissionDeadline | null) ?? null
  },

  async upsertDeadline(input: OffDaySubmissionDeadlineUpsertInput): Promise<OffDaySubmissionDeadline> {
    const { data, error } = await supabase
      .from('off_day_submission_deadline')
      .upsert({
        company_id: input.company_id,
        deadline_weekday: input.deadline_weekday,
        deadline_time: input.deadline_time,
      }, { onConflict: 'company_id' })
      .select('company_id, deadline_weekday, deadline_time')
      .single()
    if (error) throw new Error(error.message)
    return data as OffDaySubmissionDeadline
  },
}
