// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { userRepository } from '@/repositories/userRepository'
import { companyRepository } from '@/repositories/companyRepository'
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

  async leaveCompany(user_id: string, company_id: string): Promise<{ accountDeleted: boolean }> {
    const user = await userRepository.findById(user_id)
    if (!user) throw new Error('User not found')

    // Step 1: remove from this company; also null out users.company_id if it matches
    await companyRepository.removeCompanyMember(user_id, company_id)
    await companyRepository.nullifyUserCompanyId(user_id, company_id)

    // Step 2: count remaining memberships
    const remaining = await companyRepository.countMemberCompanies(user_id)

    if (remaining > 0) {
      // Step 3a: account kept, caller should sign out
      return { accountDeleted: false }
    }

    // Step 3b: no remaining companies — delete account fully
    await userRepository.deleteInboxByUserId(user_id)
    await userRepository.deleteMessagesByUserId(user_id)
    await userRepository.deleteNotificationsByUserId(user_id)
    await userRepository.deleteManagerDepartmentsByUserId(user_id)
    await userRepository.deleteById(user_id)
    await userRepository.deleteAuthUser(user.supabase_auth_id)
    return { accountDeleted: true }
  },

}
