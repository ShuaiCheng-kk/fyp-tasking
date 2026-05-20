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
  ): Promise<void> {
    const company = await companyRepository.findById(company_id)
    if (!company) throw new Error('Company not found')

    const requester = await userRepository.findByAuthIdOrInternalId(requesting_user_id)
    if (!requester) throw new Error('Requesting user not found')

    const target = await userRepository.findById(user_id_to_remove)
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

    // STEP 1: get the Supabase Auth id before deleting the users row
    const supabaseAuthId = target.supabase_auth_id

    // STEP 2: delete from public.users
    await userRepository.deleteById(user_id_to_remove)

    // STEP 3: delete from Supabase Auth
    if (supabaseAuthId) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(supabaseAuthId)
      if (error) throw new Error(`Failed to delete auth user: ${error.message}`)
    }
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
