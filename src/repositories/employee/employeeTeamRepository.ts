import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()

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
      }
    }

    const { data: teamUsers, error: teamErr } = await supabase
      .from('users')
      .select('id, full_name, email_address, role')
      .eq('company_id', currentUser.company_id)
      .eq('department_id', currentUser.department_id)
      .in('role', ['Manager', 'Employee'])

    if (teamErr) {
      throw new Error(teamErr.message)
    }

    const users = (teamUsers ?? []) as TeamUser[]

    const manager =
      users.find((user) => user.role === 'Manager') ?? null

    const employees = users.filter(
      (user) => user.role === 'Employee' && user.id !== user_id
    )

    return {
      manager,
      employees,
    }
  },
}