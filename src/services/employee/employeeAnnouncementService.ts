import { employeeAnnouncementRepository } from '@/repositories/employee/employeeAnnouncementRepository'
import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

export const employeeAnnouncementService = {

  async getAnnouncements(auth_user_id: string): Promise<{
    id: string
    from_user_id: string
    company_id: string
    department_id: string | null
    title: string
    content: string
    created_at: string
    created_by_name: string | null
  }[]> {
    const user = await employeeInboxRepository.findUserByAuthIdOrInternalId(auth_user_id)
    if (!user) throw new Error('User not found')
    return employeeAnnouncementRepository.getEmployeeAnnouncements((user as any).id)
  },

}
