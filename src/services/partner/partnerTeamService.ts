import { partnerTeamRepository } from '@/repositories/partner/partnerTeamRepository'
import { User } from '@/types/auth.types'

const ROLE_ORDER: Record<string, number> = { Owner: 0, Partner: 1, Manager: 2, Employee: 3, 'Casual Worker': 4, 'Guest User': 5 }

export const partnerTeamService = {

  async getTeamByCompany(company_id: string): Promise<User[]> {
    const members = await partnerTeamRepository.findMembersByCompanyId(company_id)
    return members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
  },

}
