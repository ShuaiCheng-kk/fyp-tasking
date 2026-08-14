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
    // A worker who already clocked out today is off duty and can't take on a new task — same rule
    // as the Member panel / New-Edit Task pickers in TasksView.tsx (2026-07-31).
    //
    // Deduped by user id: getSupervisedWorkersToday returns one row per shift ASSIGNMENT (the
    // Dashboard's worker cards need that — one card per shift, each with its own clock times), so
    // a worker covering two shifts today under the same supervisor came back twice and showed up
    // as a duplicate name in the AI Assign candidate list. Filtering before deduping is deliberate:
    // someone who clocked out of an earlier shift but is still on a later one stays available.
    const available = new Map<string, { id: string; full_name: string }>()
    for (const w of workers) {
      if (w.clock_out_time) continue
      if (!available.has(w.id)) available.set(w.id, { id: w.id, full_name: w.full_name })
    }
    return {
      department_id: dashboard?.department_id ?? '',
      candidates: [...available.values()],
    }
  },
}