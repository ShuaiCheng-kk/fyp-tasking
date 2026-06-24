import { supabase } from '@/lib/supabase'

export const casualAvailabilityRepository = {
  async getUserByAuthId(authId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .or(`supabase_auth_id.eq.${authId},id.eq.${authId}`)
      .eq('role', 'Casual Worker')
      .maybeSingle()

    if (error) throw error
    return data
  },
}
