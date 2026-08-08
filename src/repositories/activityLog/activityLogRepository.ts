// LAYER: Repository
// RULE: DB access only. Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { ActivityLog, ActivityLogInput } from '@/types/ActivityLog'

export const activityLogRepository = {
  async insert(input: ActivityLogInput): Promise<void> {
    const { error } = await supabase.from('company_activity_logs').insert({
      company_id: input.company_id,
      actor_id: input.actor_id,
      action: input.action,
      target_id: input.target_id ?? null,
      target_name: input.target_name ?? null,
      detail: input.detail ?? null,
    })
    if (error) throw new Error(`Failed to insert activity log: ${error.message}`)
  },

  async listByCompany(company_id: string, sinceDays = 30, limit = 500): Promise<ActivityLog[]> {
    const since = new Date()
    since.setDate(since.getDate() - sinceDays)
    const { data, error } = await supabase
      .from('company_activity_logs')
      .select('*')
      .eq('company_id', company_id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(`Failed to fetch activity logs: ${error.message}`)
    return (data ?? []) as ActivityLog[]
  },
}
