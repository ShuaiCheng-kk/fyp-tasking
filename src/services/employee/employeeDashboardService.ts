import { employeeDashboardRepository } from '@/repositories/employee/employeeDashboardRepository'
import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

export const employeeDashboardService = {
  async getDashboard(
    auth_user_id: string
  ): Promise<{
    company_name: string
    department_name: string
    assigned_work: {
      id: string
      title: string
      description: string | null
      shift_date: string
      start_time: string
      end_time: string
      assignment_status: string
    }[]
  }> {
    const user =
      await employeeInboxRepository.findUserByAuthIdOrInternalId(
        auth_user_id
      )

    if (!user) {
      throw new Error('User not found')
    }

    const dashboard =
      await employeeDashboardRepository.getEmployeeDashboard(
        (user as any).id
      )

    if (!dashboard) {
      throw new Error('Dashboard data not found')
    }

    const assignedWork =
      await employeeDashboardRepository.getAssignedWork(
        (user as any).id
      )

    return {
      ...dashboard,
      assigned_work: assignedWork,
    }
  },
}