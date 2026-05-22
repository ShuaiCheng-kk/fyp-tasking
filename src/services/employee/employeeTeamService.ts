import { employeeTeamRepository } from '@/repositories/employee/employeeTeamRepository'
import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

export const employeeTeamService = {

  async getTeam(auth_user_id: string): Promise<{
    manager: { id: string; full_name: string; email_address: string; role: string } | null
    teammates: { id: string; full_name: string; email_address: string; role: string }[]
  }> {
    const user = await employeeInboxRepository.findUserByAuthIdOrInternalId(auth_user_id)
    if (!user) throw new Error('User not found')
    return employeeTeamRepository.getEmployeeTeam((user as any).id)
  },

}
