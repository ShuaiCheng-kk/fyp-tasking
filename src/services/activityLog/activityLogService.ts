// LAYER: Service
// RULE: Business logic only. No HTTP handling. No direct DB access.

import { activityLogRepository } from '@/repositories/activityLog/activityLogRepository'
import { ActivityLog, ActivityLogInput } from '@/types/ActivityLog'

export const activityLogService = {
  async log(input: ActivityLogInput): Promise<void> {
    await activityLogRepository.insert(input)
  },

  async getCompanyLogs(company_id: string): Promise<ActivityLog[]> {
    return activityLogRepository.listByCompany(company_id, 30)
  },

  async markAllRead(company_id: string): Promise<void> {
    await activityLogRepository.markAllRead(company_id)
  },
}
