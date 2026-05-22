import { managerTeamRepository } from '@/repositories/manager/managerTeamRepository'
import { User } from '@/types/auth.types'

const ROLE_ORDER: Record<string, number> = { Owner: 0, Partner: 1, Manager: 2, Employee: 3, 'Casual Worker': 4, 'Guest User': 5 }

export const managerTeamService = {

  async getTeamByCompany(company_id: string): Promise<User[]> {
    const members = await managerTeamRepository.findMembersByCompanyId(company_id)
    return members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))
  },

  async getManagerDepartments(manager_id: string, company_id: string): Promise<{ department_id: string; department_name: string }[]> {
    return managerTeamRepository.findManagerDepartments(manager_id, company_id)
  },

  async assignManagerToDepartment(manager_id: string, company_id: string, department_id: string, assigned_by: string): Promise<void> {
    const manager = await managerTeamRepository.findUserById(manager_id)
    if (!manager || manager.company_id !== company_id) {
      throw new Error('Manager not found in this company')
    }
    await managerTeamRepository.assignManagerDepartment(manager_id, company_id, department_id, assigned_by)
  },

  async removeManagerFromDepartment(manager_id: string, department_id: string): Promise<void> {
    const manager = await managerTeamRepository.findUserById(manager_id)
    if (!manager) throw new Error('Manager not found')
    if (manager.department_id === department_id) {
      throw new Error('Cannot remove manager from their primary department')
    }
    await managerTeamRepository.removeManagerDepartment(manager_id, department_id)
  },

}
