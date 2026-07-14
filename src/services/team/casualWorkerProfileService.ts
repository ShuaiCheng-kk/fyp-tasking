// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualWorkerProfileRepository } from '@/repositories/team/casualWorkerProfileRepository'
import { WorkerCertificate } from '@/types/WorkerProfile'

export const casualWorkerProfileService = {
  async getCertificates(user_id: string): Promise<WorkerCertificate[]> {
    if (!user_id) throw new Error('user_id is required')
    return casualWorkerProfileRepository.getCertificatesByUserId(user_id)
  },
}
