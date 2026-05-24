import { employeeDashboardRepository } from '@/repositories/employee/employeeDashboardRepository'
import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

type AssignedWorkDTO = {
  id: string
  shift_id: string
  title: string
  instruction: string | null
  shift_date: string
  start_time: string
  end_time: string
  assignment_status: string
  casual_worker_name: string
  casual_worker_email: string
  manager_name: string
  manager_email: string
}

export const employeeDashboardService = {
  async getDashboard(
    auth_user_id: string
  ): Promise<{
    company_name: string
    department_name: string
    assigned_work: AssignedWorkDTO[]
  }> {
    const user =
      await employeeInboxRepository.findUserByAuthIdOrInternalId(auth_user_id)

    if (!user) {
      throw new Error('User not found')
    }

    const internalUserId = (user as any).id

    const dashboard =
      await employeeDashboardRepository.getEmployeeDashboard(internalUserId)

    if (!dashboard) {
      throw new Error('Dashboard data not found')
    }

    const assignedWork =
      await employeeDashboardRepository.getAssignedWork(internalUserId)

    return {
      company_name: dashboard.company_name,
      department_name: dashboard.department_name,
      assigned_work: assignedWork,
    }
  },
}