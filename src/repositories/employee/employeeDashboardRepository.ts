import { supabase } from '@/lib/supabase'

export const employeeDashboardRepository = {

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

}
