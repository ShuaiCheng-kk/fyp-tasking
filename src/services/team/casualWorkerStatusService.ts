// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualWorkerStatusRepository } from '@/repositories/team/casualWorkerStatusRepository'

export const casualWorkerStatusService = {
  // "Inactive" = ban this Casual Worker from applying to THIS company's jobs (per-company, stored
  // on casualworker_departments). "Active" = lift that ban. A company_id is required because the
  // ban is company-scoped; the global users.worker_status column is only mirrored for display.
  async updateStatus({
    user_id,
    company_id,
    worker_status,
    inactivate_reason,
  }: {
    user_id: string
    company_id: string
    worker_status: string
    inactivate_reason: string | null
  }) {
    const isBan = worker_status === 'inactive'
    // Reactivating clears the stored reason; banning keeps it.
    const reasonToStore = isBan ? inactivate_reason : null

    await casualWorkerStatusRepository.setCompanyBlock(
      user_id,
      company_id,
      isBan ? new Date().toISOString() : null,
      reasonToStore,
    )

    if (isBan) {
      // A banned worker's still-pending applications to this company are void — withdraw them.
      const jobIds = await casualWorkerStatusRepository.getCompanyJobIds(company_id)
      await casualWorkerStatusRepository.withdrawPendingApplicationsForJobs(user_id, jobIds)
    }

    // Mirror onto the global column so display surfaces that still read worker_status stay in sync.
    return casualWorkerStatusRepository.updateStatus(user_id, worker_status, reasonToStore)
  },
}
