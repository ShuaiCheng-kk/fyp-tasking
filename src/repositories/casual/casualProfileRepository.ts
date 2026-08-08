import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()

export const casualProfileRepository = {
  async getUserByAuthId(authId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, casual_worker_profiles(payment_method, payment_account)')
      .eq('supabase_auth_id', authId)
      .eq('role', 'Casual Worker')
      .maybeSingle()

    if (error) throw error
    if (!data) return null
    const row = data as any
    const profile = Array.isArray(row.casual_worker_profiles) ? row.casual_worker_profiles[0] : row.casual_worker_profiles
    return {
      id: row.id,
      full_name: row.full_name,
      role: row.role,
      payment_method: profile?.payment_method ?? null,
      payment_account: profile?.payment_account ?? null,
    }
  },

  async updatePaymentInfo(userId: string, payment_method: string, payment_account: string): Promise<void> {
    const { error } = await supabase
      .from('casual_worker_profiles')
      .upsert({ user_id: userId, payment_method, payment_account }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
  },
}