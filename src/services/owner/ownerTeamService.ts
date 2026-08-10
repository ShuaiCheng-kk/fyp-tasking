import { ownerTeamRepository } from '@/repositories/owner/ownerTeamRepository'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { User } from '@/types/auth.types'


const ROLE_ORDER: Record<string, number> = { Owner: 0, Partner: 1, Manager: 2, Employee: 3, 'Casual Worker': 4, 'Guest User': 5 }

export interface RemovalNotice {
  to: string
  fullName: string
  companyName: string
}

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

  // removalNotice is the "you've been removed" email the caller should send AFTER responding, not
  // something this method sends itself - see the comment at the end of the method.
  async removeMember(
    company_id: string,
    user_id_to_remove: string,
    requesting_user_id: string,
  ): Promise<{ success: true; accountDeleted: boolean; removalNotice: RemovalNotice }> {
    const company = await ownerTeamRepository.findCompanyById(company_id)
    if (!company) throw new Error('Company not found')

    const requester = await ownerTeamRepository.findUserByAuthIdOrInternalId(requesting_user_id)
    if (!requester) throw new Error('Requesting user not found')

    const target = await ownerTeamRepository.findUserById(user_id_to_remove)
    if (!target) throw new Error('Target user not found')

    if (user_id_to_remove === company.owner_id) throw new Error('Cannot remove the company creator')
    if (user_id_to_remove === requester.id) throw new Error('Cannot remove yourself')
    if (target.company_id !== company_id) throw new Error('User is not a member of this company')

    // Only the company creator (the true Owner) may remove a member — Partner is a clone of Owner
    // in every other feature, but removing members is deliberately Owner-only, so a Partner cannot
    // remove anyone: not another Partner, not a Manager, not an Employee.
    const requesterIsCreator = requester.id === company.owner_id
    if (!requesterIsCreator) {
      throw new Error('Insufficient permissions to remove a member')
    }

    // BUG-084: everything this person created/was assigned/supervised used to get reassigned to
    // whichever Owner clicked Remove — but the Owner doesn't run that day-to-day, so this reassigns
    // to a real peer instead (keeps a genuinely accountable owner, and the audit trail stays
    // meaningful: "who's actually handling this now"). The replacement differs by role:
    //   - Partner: another Partner if one exists, otherwise Owner (Owner always exists, so removing
    //     a Partner is NEVER blocked — there's always a valid fallback).
    //   - Manager: another Manager in the SAME department. Blocked if that department would be left
    //     with zero Managers — the Owner must assign a replacement first.
    //   - Employee: another Employee in the SAME department (this REPLACES the previous hard block
    //     on "supervises live recruitment jobs or upcoming casual shifts" — instead of refusing to
    //     remove them until someone manually reassigns those things first, removal now reassigns
    //     automatically as long as a same-department replacement exists; blocked only if none does).
    let reassignTo = requester.id
    let reassignAssigneeTo: string | null = null

    if (target.role === 'Partner') {
      const otherPartners = (await ownerTeamRepository.findPartnersByCompany(company_id)).filter(p => p.id !== user_id_to_remove)
      const replacement = otherPartners[0]?.id ?? company.owner_id
      reassignTo = replacement
      reassignAssigneeTo = replacement
    }

    if (target.role === 'Manager') {
      const myDepartments = await ownerTeamRepository.findManagerDepartments(user_id_to_remove, company_id)
      for (const dept of myDepartments) {
        const deptManagers = await ownerTeamRepository.findManagersByDepartment(company_id, dept.department_id)
        const others = deptManagers.filter(m => m.id !== user_id_to_remove)
        if (others.length === 0) {
          throw new Error(
            `${target.full_name} is the only Manager in the ${dept.department_name} department. Assign another Manager to this department before removing them.`
          )
        }
        if (dept.department_id === myDepartments[0].department_id) {
          reassignTo = others[0].id
          reassignAssigneeTo = others[0].id
        }
      }
    }

    if (target.role === 'Employee') {
      const myDepartments = await ownerTeamRepository.findEmployeeDepartments(user_id_to_remove, company_id)
      for (const dept of myDepartments) {
        const deptEmployees = await ownerTeamRepository.findEmployeesByDepartment(company_id, dept.department_id)
        const others = deptEmployees.filter(e => e.id !== user_id_to_remove)
        if (others.length === 0) {
          throw new Error(
            `${target.full_name} is the only Employee in the ${dept.department_name} department. Assign another Employee to this department before removing them.`
          )
        }
        if (dept.department_id === myDepartments[0].department_id) {
          reassignTo = others[0].id
          reassignAssigneeTo = others[0].id
        }
      }
    }

    const supabaseAuthId = target.supabase_auth_id

    await ownerTeamRepository.deleteMessagesByUserId(user_id_to_remove)
    await ownerTeamRepository.cleanupUserOperationalReferences(user_id_to_remove, reassignTo, target.full_name, reassignAssigneeTo)
    await ownerTeamRepository.deleteManagerDepartmentsByUserId(user_id_to_remove)
    await ownerTeamRepository.deleteEmployeeDepartmentsByUserId(user_id_to_remove)
    await ownerTeamRepository.deleteUserById(user_id_to_remove)

    if (supabaseAuthId) {
      const { error } = await getSupabaseAdmin().auth.admin.deleteUser(supabaseAuthId)
      if (error) throw new Error(`Failed to delete auth user: ${error.message}`)
    }

    // UC30: the removed member still needs the "you've been removed" email — their account is gone
    // by this point, so it's the only way they find out. It is deliberately NOT sent here: the
    // removal has already fully succeeded above, the email's outcome is discarded either way, and
    // awaiting it made the caller wait out the email provider's latency (a measured 14.6s spike on
    // a removal whose database work had finished seconds earlier). Returned instead, for the route
    // to send after it has already responded - see sendRemovalNotice.
    return {
      success: true,
      accountDeleted: true,
      removalNotice: {
        to: target.email_address,
        fullName: target.full_name,
        companyName: company.name,
      },
    }
  },

  // Best-effort, fire-and-forget: never surfaces to the caller, never fails the removal.
  async sendRemovalNotice(notice: RemovalNotice): Promise<void> {
    try {
      const { emailService } = await import('@/services/email/emailService')
      await emailService.sendRemovedFromCompanyEmail(notice)
    } catch { /* best-effort notification only */ }
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
    )
  },

  async assignManagerToDepartment(manager_id: string, company_id: string, department_id: string): Promise<void> {
    const manager = await ownerTeamRepository.findUserById(manager_id)
    if (!manager || manager.company_id !== company_id) {
      throw new Error('Manager not found in this company')
    }
    await ownerTeamRepository.assignManagerDepartment(manager_id, company_id, department_id)
  },

  async removeManagerFromDepartment(manager_id: string, department_id: string, company_id?: string): Promise<void> {
    const manager = await ownerTeamRepository.findUserById(manager_id)
    if (!manager) throw new Error('Manager not found')
    if (company_id && manager.company_id !== company_id) {
      throw new Error('You can only manage your own company\'s departments')
    }
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
