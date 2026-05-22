import { employeeDashboardRepository } from '@/repositories/employee/employeeDashboardRepository'
import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

export const employeeDashboardService = {

  async getDashboard(auth_user_id: string): Promise<{ company_name: string; department_name: string }> {
    const user = await employeeInboxRepository.findUserByAuthIdOrInternalId(auth_user_id)
    if (!user) throw new Error('User not found')

    const result = await employeeDashboardRepository.getEmployeeDashboard((user as any).id)
    if (!result) throw new Error('Dashboard data not found')
    return result
  },

}
