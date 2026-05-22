import { supabase } from '@/lib/supabase'

export const employeeTeamRepository = {

  async getEmployeeTeam(user_id: string): Promise<{
    manager: { id: string; full_name: string; email_address: string; role: string } | null
    teammates: { id: string; full_name: string; email_address: string; role: string }[]
  }> {
    const { data: empDept } = await supabase
      .from('employee_departments')
      .select('department_id')
      .eq('employee_id', user_id)
      .single()
    if (!empDept?.department_id) return { manager: null, teammates: [] }

    const { department_id } = empDept

    const { data: mgrDept } = await supabase
      .from('manager_departments')
      .select('manager_id')
      .eq('department_id', department_id)
      .limit(1)
      .single()

    let manager: { id: string; full_name: string; email_address: string; role: string } | null = null
    if (mgrDept?.manager_id) {
      const { data: mgrUser } = await supabase
        .from('users')
        .select('id, full_name, email_address, role')
        .eq('id', mgrDept.manager_id)
        .single()
      if (mgrUser) manager = mgrUser as { id: string; full_name: string; email_address: string; role: string }
    }

    const { data: teammates } = await supabase
      .from('employee_departments')
      .select('employee_id, users!inner(id, full_name, email_address, role)')
      .eq('department_id', department_id)
      .neq('employee_id', user_id)

    const mappedTeammates = ((teammates ?? []) as any[])
      .map(row => row.users)
      .filter(Boolean) as { id: string; full_name: string; email_address: string; role: string }[]

    return { manager, teammates: mappedTeammates }
  },

}
