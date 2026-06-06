import { employeeTeamRepository } from '@/repositories/employee/employeeTeamRepository'
import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

type TeamUser = {
  id: string
  full_name: string
  email_address: string
  role: string
}

export const employeeTeamService = {
  async getTeam(auth_user_id: string): Promise<{
    manager: TeamUser | null
    employees: TeamUser[]
    casual_workers: TeamUser[]
  }> {
    const user =
      await employeeInboxRepository.findUserByAuthIdOrInternalId(auth_user_id)

    if (!user) {
      throw new Error('User not found')
    }

    return employeeTeamRepository.getEmployeeTeam((user as TeamUser).id)
  },
}