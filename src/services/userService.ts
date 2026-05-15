// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { userRepository } from '@/repositories/userRepository'
import { User } from '@/types'

const ROLE_ORDER: Record<string, number> = { Owner: 0, Manager: 1, Employee: 2, 'Casual Worker': 3, 'Guest User': 4 }

export const userService = {

  async getUserById(id: string): Promise<User> {
    const user = await userRepository.findById(id)
    if (!user) throw new Error('User not found')
    return user
  },

  async getTeamByCompany(company_id: string): Promise<User[]> {
    const members = await userRepository.findMembersByCompanyId(company_id)
    return members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
  },

}
