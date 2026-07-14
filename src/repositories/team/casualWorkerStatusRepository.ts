// LAYER: Repository
// RULE: DB access only. Supabase queries only. No business logic.

import { supabase } from '@/lib/supabase'

export const casualWorkerStatusRepository = {
  // Mirror of the ban onto the global users.worker_status column, kept so display surfaces that
  // still read worker_status (e.g. the attendance review badge) stay roughly in sync. The
  // authoritative, per-company ban lives on casualworker_departments (setCompanyBlock below).
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

  // Per-company ban: stamp (or clear) blocked_at on every casualworker_departments row this worker
  // holds in the company, so the ban is scoped to this company only.
  async setCompanyBlock(
    casual_worker_id: string,
    company_id: string,
    blocked_at: string | null,
    blocked_reason: string | null
  ): Promise<void> {
    const { error } = await supabase
      .from('casualworker_departments')
      .update({ blocked_at, blocked_reason })
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
