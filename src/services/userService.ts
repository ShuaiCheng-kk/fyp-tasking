// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { userRepository } from '@/repositories/userRepository'
import { User } from '@/types'

const ROLE_ORDER: Record<string, number> = { Owner: 0, Manager: 1, Employee: 2, 'Casual Worker': 3, 'Guest User': 4 }

export const userService = {

  async getUserById(id: string): Promise<User> {
    const user = await userRepository.findByAuthIdOrInternalId(id)
    if (!user) throw new Error('User not found')
    return user
  },

  async getTeamByCompany(company_id: string): Promise<User[]> {
    const members = await userRepository.findMembersByCompanyId(company_id)
    return members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
  },

  async updateUserDepartment(user_id: string, department_id: string | null): Promise<void> {
    await userRepository.updateDepartmentId(user_id, department_id)
  },

  async countMembersForOwner(internal_owner_id: string): Promise<number> {
    return userRepository.countMembersAcrossOwnedCompanies(internal_owner_id)
  },

  async leaveCompany(user_id: string): Promise<void> {
    const user = await userRepository.findById(user_id)
    if (!user) throw new Error('User not found')
    const supabase_auth_id = user.supabase_auth_id
    await userRepository.deleteById(user_id)
    await userRepository.deleteAuthUser(supabase_auth_id)
  },

}
