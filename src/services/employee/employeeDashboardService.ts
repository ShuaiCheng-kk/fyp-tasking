import { employeeDashboardRepository } from '@/repositories/employee/employeeDashboardRepository'
import { employeeInboxRepository } from '@/repositories/employee/employeeInboxRepository'

export const employeeDashboardService = {
  async getDashboard(
    auth_user_id: string
  ): Promise<{
    company_id: string
    company_name: string
    department_id: string
    department_name: string
    employee_id: string
    supervised_workers: Awaited<ReturnType<typeof employeeDashboardRepository.getSupervisedWorkersToday>>
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

    const supervisedWorkers =
      await employeeDashboardRepository.getSupervisedWorkersToday(internalUserId, dashboard.company_id)

    return {
      company_id: dashboard.company_id,
      company_name: dashboard.company_name,
      department_id: dashboard.department_id,
      department_name: dashboard.department_name,
      employee_id: internalUserId,
      supervised_workers: supervisedWorkers,
    }
  },

  // AI Assign scope for an Employee viewer (UC20, extended to Employee 2026-07-27): forces the
  // department to the Employee's own, and the candidate pool to only the Casual Workers they
  // supervise TODAY — never a whole department, mirroring getManagerTeamScope for the Manager tier.
  async getSupervisedTaskScope(
    employee_id: string,
    company_id: string
  ): Promise<{ department_id: string; candidates: { id: string; full_name: string }[] }> {
    const dashboard = await employeeDashboardRepository.getEmployeeDashboard(employee_id)
    const workers = await employeeDashboardRepository.getSupervisedWorkersToday(employee_id, company_id)
    return {
      department_id: dashboard?.department_id ?? '',
      candidates: workers.map(w => ({ id: w.id, full_name: w.full_name })),
    }
  },
}