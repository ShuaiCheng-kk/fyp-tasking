// LAYER: Service
// RULE: Only contains business logic. No HTTP handling. No direct DB access.

import { employeeRepository } from '@/repositories/employeeRepository'
import { userRepository } from '@/repositories/userRepository'

export const employeeService = {

  async getDashboard(auth_user_id: string): Promise<{ company_name: string; department_name: string }> {
    const user = await userRepository.findByAuthIdOrInternalId(auth_user_id)
    if (!user) throw new Error('User not found')

    const result = await employeeRepository.getEmployeeDashboard(user.id)
    if (!result) throw new Error('Dashboard data not found')
    return result
  },

  async getTeam(auth_user_id: string): Promise<{
    manager: { id: string; full_name: string; email_address: string; role: string } | null
    teammates: { id: string; full_name: string; email_address: string; role: string }[]
  }> {
    const user = await userRepository.findByAuthIdOrInternalId(auth_user_id)
    if (!user) throw new Error('User not found')
    return employeeRepository.getEmployeeTeam(user.id)
  },

  async getAnnouncements(auth_user_id: string): Promise<{
    id: string
    title: string
    content: string
    created_at: string
    created_by_name: string | null
  }[]> {
    const user = await userRepository.findByAuthIdOrInternalId(auth_user_id)
    if (!user) throw new Error('User not found')
    return employeeRepository.getEmployeeAnnouncements(user.id)
  },

  async getContacts(auth_user_id: string): Promise<{
    id: string
    full_name: string
    role: string
    email_address: string
  }[]> {
    const user = await userRepository.findByAuthIdOrInternalId(auth_user_id)
    if (!user) throw new Error('User not found')
    return employeeRepository.getEmployeeContacts(user.id)
  },

}
