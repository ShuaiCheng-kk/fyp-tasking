// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { casualWorkerProfileRepository } from '@/repositories/team/casualWorkerProfileRepository'
import { authRepository } from '@/repositories/auth/authRepository'
import { WorkerCertificate } from '@/types/WorkerProfile'

export const casualWorkerProfileService = {
  async getCertificates(user_id: string, viewer_company_id: string): Promise<WorkerCertificate[]> {
    if (!user_id) throw new Error('user_id is required')
    const worker = await authRepository.findById(user_id)
    if (!worker) throw new Error('Casual worker not found')
    if (worker.company_id !== viewer_company_id) throw new Error('You can only view your own company\'s workers')
    return casualWorkerProfileRepository.getCertificatesByUserId(user_id)
  },
}
