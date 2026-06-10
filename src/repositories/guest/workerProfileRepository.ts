// src/repositories/workerProfileRepository.ts
import { supabase } from '@/lib/supabase'

export const workerProfileRepository = {
  async getByAuthId(authId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('supabase_auth_id', authId)
      .single()

    if (error) throw error
    return data
  },
}