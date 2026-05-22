// LAYER: Repository
// RULE: Only handles database queries. No business logic.

import { supabase } from '@/lib/supabase'

export const employeeRepository = {

  async getEmployeeDashboard(user_id: string): Promise<{ company_name: string; department_name: string } | null> {
    const { data: member, error: memberErr } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user_id)
      .single()
    if (memberErr || !member) return null

    const { data: company, error: compErr } = await supabase
      .from('companies')
      .select('name')
      .eq('id', member.company_id)
      .single()
    if (compErr || !company) return null

    const { data: empDept } = await supabase
      .from('employee_departments')
      .select('department_id, departments(name)')
      .eq('employee_id', user_id)
      .single()

    return {
      company_name: company.name,
      department_name: (empDept?.departments as any)?.name ?? '',
    }
  },

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

    // Find the manager of this department via manager_departments
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
      if (mgrUser) manager = mgrUser as typeof manager
    }

    // Other employees in same department via employee_departments
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

  async getEmployeeAnnouncements(user_id: string): Promise<{
    id: string
    title: string
    content: string
    created_at: string
    created_by_name: string | null
  }[]> {
    const { data: empDept } = await supabase
      .from('employee_departments')
      .select('department_id')
      .eq('employee_id', user_id)
      .single()
    if (!empDept?.department_id) return []

    const { data: mgrDept } = await supabase
      .from('manager_departments')
      .select('manager_id')
      .eq('department_id', empDept.department_id)
      .limit(1)
      .single()
    if (!mgrDept?.manager_id) return []

    const { data: member } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user_id)
      .single()
    if (!member?.company_id) return []

    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, created_at, poster:users!announcements_from_user_id_fkey(full_name)')
      .eq('company_id', member.company_id)
      .eq('from_user_id', mgrDept.manager_id)
      .order('created_at', { ascending: false })
    if (error) throw error

    return (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      created_at: row.created_at,
      created_by_name: row.poster?.full_name ?? null,
    }))
  },

  async getEmployeeContacts(user_id: string): Promise<{
    id: string
    full_name: string
    role: string
    email_address: string
  }[]> {
    const { data: empDept } = await supabase
      .from('employee_departments')
      .select('department_id')
      .eq('employee_id', user_id)
      .single()
    if (!empDept?.department_id) return []

    const { department_id } = empDept
    const contacts: { id: string; full_name: string; role: string; email_address: string }[] = []

    // Manager of the department
    const { data: mgrDept } = await supabase
      .from('manager_departments')
      .select('manager_id')
      .eq('department_id', department_id)
      .limit(1)
      .single()
    if (mgrDept?.manager_id) {
      const { data: mgrUser } = await supabase
        .from('users')
        .select('id, full_name, role, email_address')
        .eq('id', mgrDept.manager_id)
        .single()
      if (mgrUser) contacts.push(mgrUser as any)
    }

    // Other employees in same department
    const { data: teammates } = await supabase
      .from('employee_departments')
      .select('employee_id, users!inner(id, full_name, role, email_address)')
      .eq('department_id', department_id)
      .neq('employee_id', user_id)

    for (const row of (teammates ?? []) as any[]) {
      if (row.users) contacts.push(row.users)
    }

    return contacts
  },

}
