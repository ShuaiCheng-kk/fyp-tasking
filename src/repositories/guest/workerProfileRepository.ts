import { supabase } from '@/lib/supabase'

export const workerProfileRepository = {
  async getByAuthId(authId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email_address, phone_number, date_of_birth, profile_photo_url, role, supabase_auth_id')
      .eq('supabase_auth_id', authId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async updateByAuthId(authId: string, values: {
    full_name: string
    phone_number: string | null
    date_of_birth: string | null
    profile_photo_url: string | null
  }) {
    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: values.full_name,
        phone_number: values.phone_number,
        date_of_birth: values.date_of_birth,
        profile_photo_url: values.profile_photo_url,
      })
      .eq('supabase_auth_id', authId)
      .select('id, full_name, email_address, phone_number, date_of_birth, profile_photo_url, role, supabase_auth_id')
      .single()

    if (error) throw error
    return data
  },
}