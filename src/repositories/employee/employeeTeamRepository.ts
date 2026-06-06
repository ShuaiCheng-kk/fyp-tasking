import { supabase } from '@/lib/supabase'

type TeamUser = {
  id: string
  full_name: string
  email_address: string
  role: string
}

export const employeeTeamRepository = {
  async getEmployeeTeam(user_id: string): Promise<{
    manager: TeamUser | null
    employees: TeamUser[]
    casual_workers: TeamUser[]
  }> {
    const { data: currentUser, error: userErr } = await supabase
      .from('users')
      .select('id, company_id, department_id')
      .eq('id', user_id)
      .single()

    if (userErr || !currentUser?.company_id || !currentUser?.department_id) {
      return {
        manager: null,
        employees: [],
        casual_workers: [],
      }
    }

    const { data: teamUsers, error: teamErr } = await supabase
      .from('users')
      .select('id, full_name, email_address, role')
      .eq('company_id', currentUser.company_id)
      .eq('department_id', currentUser.department_id)
      .in('role', ['Manager', 'Employee', 'Casual Worker'])

    if (teamErr) {
      throw new Error(teamErr.message)
    }

    const users = (teamUsers ?? []) as TeamUser[]

    const manager =
      users.find((user) => user.role === 'Manager') ?? null

    const employees = users.filter(
      (user) => user.role === 'Employee' && user.id !== user_id
    )

    const casual_workers = users.filter(
      (user) => user.role === 'Casual Worker'
    )

    return {
      manager,
      employees,
      casual_workers,
    }
  },
}