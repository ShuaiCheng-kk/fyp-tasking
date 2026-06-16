// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualWorkerStatusRepository } from '@/repositories/team/casualWorkerStatusRepository'

export const casualWorkerStatusService = {
  async updateStatus({
    user_id,
    worker_status,
    inactivate_reason,
  }: {
    user_id: string
    worker_status: string
    inactivate_reason: string | null
  }) {
    // When activating, clear the inactivate_reason
    const reasonToStore =
      worker_status === 'active' ? null : inactivate_reason

    return await casualWorkerStatusRepository.updateStatus(
      user_id,
      worker_status,
      reasonToStore
    )
  },
}
