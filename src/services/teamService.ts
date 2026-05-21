// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { companyRepository } from '@/repositories/companyRepository'
import { userRepository } from '@/repositories/userRepository'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const teamService = {

  async removeMember(
    company_id: string,
    user_id_to_remove: string,
    requesting_user_id: string,
  ): Promise<{ success: true; accountDeleted: boolean }> {
    console.log('[removeMember] START — company_id:', company_id, 'user_id_to_remove:', user_id_to_remove, 'requesting_user_id:', requesting_user_id)

    const company = await companyRepository.findById(company_id)
    console.log('[removeMember] company lookup:', company ? company.id : 'NOT FOUND')
    if (!company) throw new Error('Company not found')

    const requester = await userRepository.findByAuthIdOrInternalId(requesting_user_id)
    console.log('[removeMember] requester lookup:', requester ? requester.id : 'NOT FOUND')
    if (!requester) throw new Error('Requesting user not found')

    const target = await userRepository.findById(user_id_to_remove)
    console.log('[removeMember] target lookup:', target ? target.id : 'NOT FOUND')
    if (!target) throw new Error('Target user not found')

    if (user_id_to_remove === company.owner_id) {
      throw new Error('Cannot remove the company creator')
    }
    if (user_id_to_remove === requester.id) {
      throw new Error('Cannot remove yourself')
    }

    const requesterIsCreator = requester.id === company.owner_id
    if (!requesterIsCreator && target.role === 'Owner') {
      throw new Error('Insufficient permissions to remove a Partner')
    }

    // STEP 1: Delete from company_members
    console.log('[removeMember] STEP 1 — deleting from company_members WHERE user_id =', user_id_to_remove, 'AND company_id =', company_id)
    const removedFromMembers = await companyRepository.removeCompanyMember(user_id_to_remove, company_id)
    console.log('[removeMember] STEP 1 — removedFromMembers:', removedFromMembers)
    if (!removedFromMembers) throw new Error('User is not a member of this company')

    // STEP 2: Clean up legacy users.company_id field
    console.log('[removeMember] STEP 2 — nullifying users.company_id WHERE id =', user_id_to_remove, 'AND company_id =', company_id)
    await companyRepository.nullifyUserCompanyId(user_id_to_remove, company_id)

    // STEP 3: Check remaining company memberships
    console.log('[removeMember] STEP 3 — counting remaining company_members rows for user_id:', user_id_to_remove)
    const remainingCount = await companyRepository.countMemberCompanies(user_id_to_remove)
    console.log('[removeMember] STEP 3 — remainingCount:', remainingCount)

    // STEP 4a: User still belongs to other companies — leave account intact
    if (remainingCount > 0) {
      console.log('[removeMember] STEP 4a — user has remaining companies, returning accountDeleted: false')
      return { success: true, accountDeleted: false }
    }

    // STEP 4b: No remaining companies — delete all user data and auth account
    console.log('[removeMember] STEP 4b — no remaining companies, proceeding to full account deletion')
    const supabaseAuthId = target.supabase_auth_id
    console.log('[removeMember] supabase_auth_id:', supabaseAuthId ?? 'null')

    console.log('[removeMember] deleting from inbox WHERE recipient_user_id or sender_user_id =', user_id_to_remove)
    await userRepository.deleteInboxByUserId(user_id_to_remove)
    console.log('[removeMember] inbox deleted')

    console.log('[removeMember] deleting from messages WHERE from_user_id or to_user_id =', user_id_to_remove)
    await userRepository.deleteMessagesByUserId(user_id_to_remove)
    console.log('[removeMember] messages deleted')

    console.log('[removeMember] deleting from notifications WHERE to_user_id or from_user_id =', user_id_to_remove)
    await userRepository.deleteNotificationsByUserId(user_id_to_remove)
    console.log('[removeMember] notifications deleted')

    console.log('[removeMember] deleting from manager_departments WHERE manager_id =', user_id_to_remove)
    await userRepository.deleteManagerDepartmentsByUserId(user_id_to_remove)
    console.log('[removeMember] manager_departments deleted')

    console.log('[removeMember] deleting remaining company_members rows for user_id:', user_id_to_remove)
    await companyRepository.deleteAllCompanyMembersByUserId(user_id_to_remove)
    console.log('[removeMember] company_members deleted')

    console.log('[removeMember] deleting from users table WHERE id =', user_id_to_remove)
    await userRepository.deleteById(user_id_to_remove)
    console.log('[removeMember] users row deleted')

    if (supabaseAuthId) {
      console.log('[removeMember] deleting from Supabase Auth, supabase_auth_id:', supabaseAuthId)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(supabaseAuthId)
      if (error) throw new Error(`Failed to delete auth user: ${error.message}`)
      console.log('[removeMember] Supabase Auth user deleted')
    }

    console.log('[removeMember] DONE — returning accountDeleted: true')
    return { success: true, accountDeleted: true }
  },

  async getManagerDepartments(
    manager_id: string,
    company_id: string,
  ): Promise<{ department_id: string; department_name: string }[]> {
    return companyRepository.findManagerDepartments(manager_id, company_id)
  },

  async assignManagerToDepartment(
    manager_id: string,
    company_id: string,
    department_id: string,
    assigned_by: string,
  ): Promise<void> {
    const manager = await userRepository.findById(manager_id)
    if (!manager || manager.company_id !== company_id) {
      throw new Error('Manager not found in this company')
    }

    await companyRepository.assignManagerDepartment(manager_id, company_id, department_id, assigned_by)
  },

  async removeManagerFromDepartment(
    manager_id: string,
    department_id: string,
  ): Promise<void> {
    const manager = await userRepository.findById(manager_id)
    if (!manager) throw new Error('Manager not found')

    if (manager.department_id === department_id) {
      throw new Error('Cannot remove manager from their primary department')
    }

    await companyRepository.removeManagerDepartment(manager_id, department_id)
  },

}
