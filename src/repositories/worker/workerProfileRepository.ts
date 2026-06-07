import { supabase } from '@/lib/supabase'

export const workerProfileRepository = {
  async getProfileByAuthId(authId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email_address, phone_number, role')
      .eq('supabase_auth_id', authId)
      .single()

    if (error) throw new Error(error.message)

    return data
  },
}