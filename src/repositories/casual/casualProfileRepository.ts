import { supabase } from '@/lib/supabase'

export const casualProfileRepository = {
  async getUserByAuthId(authId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, payment_method, payment_account')
      .eq('supabase_auth_id', authId)
      .eq('role', 'Casual Worker')
      .maybeSingle()

    if (error) throw error
    return data
  },

  async updatePaymentInfo(userId: string, payment_method: string, payment_account: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ payment_method, payment_account })
      .eq('id', userId)
    if (error) throw new Error(error.message)
  },
}