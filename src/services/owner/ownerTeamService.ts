import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { User } from '@/types/auth.types'


const ROLE_ORDER: Record<string, number> = { Owner: 0, Partner: 1, Manager: 2, Employee: 3, 'Casual Worker': 4, 'Guest User': 5 }

export const ownerTeamService = {

  async getTeamByCompany(company_id: string): Promise<User[]> {
    const members = await ownerTeamRepository.findMembersByCompanyId(company_id)
    return members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
  },

  async getManagersByDepartment(company_id: string, department_id: string): Promise<{ id: string; full_name: string }[]> {
    return ownerTeamRepository.findManagersByDepartment(company_id, department_id)
  },

  async getAllManagersByCompany(company_id: string): Promise<{ id: string; full_name: string }[]> {
    return ownerTeamRepository.findManagersByCompany(company_id)
  },

  async removeMember(
    company_id: string,
    user_id_to_remove: string,
    requesting_user_id: string,
  ): Promise<{ success: true; accountDeleted: boolean }> {
    console.log('[removeMember] START — company_id:', company_id, 'user_id_to_remove:', user_id_to_remove, 'requesting_user_id:', requesting_user_id)

    const company = await ownerTeamRepository.findCompanyById(company_id)
    if (!company) throw new Error('Company not found')

    const requester = await ownerTeamRepository.findUserByAuthIdOrInternalId(requesting_user_id)
    if (!requester) throw new Error('Requesting user not found')

    const target = await ownerTeamRepository.findUserById(user_id_to_remove)
    if (!target) throw new Error('Target user not found')

    if (user_id_to_remove === company.owner_id) throw new Error('Cannot remove the company creator')
    if (user_id_to_remove === requester.id) throw new Error('Cannot remove yourself')
    if (target.company_id !== company_id) throw new Error('User is not a member of this company')

    const requesterIsCreator = requester.id === company.owner_id
    if (!requesterIsCreator && target.role === 'Owner') {
      throw new Error('Insufficient permissions to remove a Partner')
    }

    // An Employee who is the responsible supervisor on live recruitment jobs or upcoming casual
    // shifts cannot simply vanish — the workers hired through them would lose their on-site
    // contact and the attendance chain its first approver. The supervisor must be reassigned
    // before removal.
    if (target.role === 'Employee') {
      const today = new Date()
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const [activePostings, upcomingShifts] = await Promise.all([
        ownerTeamRepository.countSupervisedActivePostings(user_id_to_remove),
        ownerTeamRepository.countSupervisedUpcomingShifts(user_id_to_remove, todayKey),
      ])
      if (activePostings > 0 || upcomingShifts > 0) {
        throw new Error(
          'This employee is the responsible supervisor for active recruitment jobs or upcoming casual shifts. Assign another supervisor to those first, then remove them.'
        )
      }
    }

    const supabaseAuthId = target.supabase_auth_id

    await ownerTeamRepository.deleteInboxByUserId(user_id_to_remove)
    await ownerTeamRepository.deleteMessagesByUserId(user_id_to_remove)
    await ownerTeamRepository.cleanupUserOperationalReferences(user_id_to_remove, requester.id)
    await ownerTeamRepository.deleteManagerDepartmentsByUserId(user_id_to_remove)
    await ownerTeamRepository.deleteEmployeeDepartmentsByUserId(user_id_to_remove)
    await ownerTeamRepository.deleteUserById(user_id_to_remove)

    if (supabaseAuthId) {
      const { error } = await getSupabaseAdmin().auth.admin.deleteUser(supabaseAuthId)
      if (error) throw new Error(`Failed to delete auth user: ${error.message}`)
    }

    return { success: true, accountDeleted: true }
  },

  async getManagerDepartments(manager_id: string, company_id: string): Promise<{ department_id: string; department_name: string }[]> {
    return ownerTeamRepository.findManagerDepartments(manager_id, company_id)
  },

  async getDepartmentManagers(company_id: string): Promise<{
    department_id: string
    manager_id: string
    manager_name: string
  }[]> {
    return ownerTeamRepository.findDepartmentManagers(company_id)
  },

  async setDepartmentManager(data: {
    manager_id: string
    company_id: string
    department_id: string
    assigned_by: string
  }): Promise<void> {
    const manager = await ownerTeamRepository.findUserById(data.manager_id)
    if (!manager || manager.company_id !== data.company_id || manager.role !== 'Manager') {
      throw new Error('Manager not found in this company')
    }
    await ownerTeamRepository.removeManagerDepartmentsByCompany(data.manager_id, data.company_id)
    await ownerTeamRepository.assignManagerDepartment(
      data.manager_id,
      data.company_id,
      data.department_id,
      data.assigned_by,
    )
  },

  async assignManagerToDepartment(manager_id: string, company_id: string, department_id: string, assigned_by: string): Promise<void> {
    const manager = await ownerTeamRepository.findUserById(manager_id)
    if (!manager || manager.company_id !== company_id) {
      throw new Error('Manager not found in this company')
    }
    await ownerTeamRepository.assignManagerDepartment(manager_id, company_id, department_id, assigned_by)
  },

  async removeManagerFromDepartment(manager_id: string, department_id: string): Promise<void> {
    const manager = await ownerTeamRepository.findUserById(manager_id)
    if (!manager) throw new Error('Manager not found')
    await ownerTeamRepository.removeManagerDepartment(manager_id, department_id)
  },

  // UC31: move a Manager or Employee to a different department, replacing whatever department
  // they were previously in (both roles hold exactly one department membership row at a time).
  async changeMemberDepartment(data: {
    user_id: string
    department_id: string
    company_id?: string | null
  }): Promise<void> {
    if (!data.user_id) throw new Error('user_id is required')
    if (!data.department_id) throw new Error('department_id is required')

    const user = await ownerTeamRepository.findUserById(data.user_id)
    if (!user) throw new Error('User not found')

    const resolvedCompanyId = data.company_id || user.company_id
    if (!resolvedCompanyId) throw new Error('Cannot resolve company_id for user')
    if (user.company_id !== resolvedCompanyId) throw new Error('User is not a member of this company')

    const department = await ownerTeamRepository.findDepartmentById(data.department_id, resolvedCompanyId)
    if (!department) throw new Error('Department not found in this company')

    if (user.role === 'Manager') {
      await ownerTeamRepository.removeManagerDepartmentsByCompany(data.user_id, resolvedCompanyId)
      await ownerTeamRepository.moveManagerToDepartment(data.user_id, resolvedCompanyId, data.department_id)
    } else if (user.role === 'Employee') {
      await ownerTeamRepository.deleteEmployeeDepartmentsByUserId(data.user_id)
      await ownerTeamRepository.assignEmployeeDepartment(data.user_id, data.department_id)
    } else {
      throw new Error('Only Managers and Employees can be assigned to departments')
    }
  },

}
