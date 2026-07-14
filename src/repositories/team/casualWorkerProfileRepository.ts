// LAYER: Repository
// RULE: DB access only. Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'
import { WorkerCertificate } from '@/types/WorkerProfile'

export const casualWorkerProfileRepository = {
  async getCertificatesByUserId(userId: string): Promise<WorkerCertificate[]> {
    const { data, error } = await supabase
      .from('user_certificates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []) as WorkerCertificate[]
  },
}
