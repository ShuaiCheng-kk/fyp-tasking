// LAYER: Repository
// RULE: DB access only. Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'

export const casualWorkerStatusRepository = {
  async updateStatus(
    user_id: string,
    worker_status: string,
    inactivate_reason: string | null
  ) {
    const { data, error } = await supabase
      .from('users')
      .update({
        worker_status,
        inactivate_reason,
      })
      .eq('id', user_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update casual worker status: ${error.message}`)
    }

    return data
  },
}
