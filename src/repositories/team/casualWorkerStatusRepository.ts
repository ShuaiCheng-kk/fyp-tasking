// LAYER: Repository
// RULE: DB access only. Supabase queries only. No business logic.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()

export const casualWorkerStatusRepository = {
  // Per-company ban: stamp (or clear) inactive_at on every casualworker_departments row this worker
  // holds in the company, so the ban is scoped to this company only.
  async setCompanyBlock(
    casual_worker_id: string,
    company_id: string,
    inactive_at: string | null,
    inactive_reason: string | null
  ): Promise<void> {
    const { error } = await supabase
      .from('casualworker_departments')
      .update({ inactive_at, inactive_reason })
      .eq('casual_worker_id', casual_worker_id)
      .eq('company_id', company_id)
    if (error) throw new Error(`Failed to update company ban: ${error.message}`)
  },

  async getCompanyJobIds(company_id: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('job_postings')
      .select('id')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row: { id: string }) => row.id)
  },

  // On ban, a still-pending application to this company is dead on arrival — withdraw it so it
  // drops off the employer's candidate list. Confirmed/past applications are left untouched
  // (cancelling an upcoming confirmed shift is the separate Remove Worker flow).
  async withdrawPendingApplicationsForJobs(casual_worker_id: string, jobIds: string[]): Promise<void> {
    if (jobIds.length === 0) return
    const { error } = await supabase
      .from('job_applicants')
      .update({ status: 'withdrawn', decided_at: new Date().toISOString() })
      .eq('user_id', casual_worker_id)
      .eq('status', 'pending')
      .in('job_id', jobIds)
    if (error) throw new Error(error.message)
  },
}
