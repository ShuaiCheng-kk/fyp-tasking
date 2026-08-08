import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const supabase = getSupabaseAdmin()
import { Department } from '@/types/department.types'

export const departmentRepository = {

  async createDepartment(data: {
    name: string
    company_id: string
    color?: string | null
  }): Promise<Department> {
    const { data: department, error } = await supabase
      .from('departments')
      .insert(data)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return department
  },

  async findByCompanyId(company_id: string): Promise<Department[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('company_id', company_id)
    if (error) throw new Error(error.message)
    return data || []
  },

  async findById(id: string): Promise<Department | null> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  },

  async updateById(id: string, name: string, color?: string | null): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .update({ name, color })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async deleteById(id: string): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async countMembers(department_id: string): Promise<number> {
    const [managers, employees] = await Promise.all([
      supabase.from('manager_departments').select('manager_id', { count: 'exact', head: true }).eq('department_id', department_id),
      supabase.from('employee_departments').select('employee_id', { count: 'exact', head: true }).eq('department_id', department_id),
    ])
    if (managers.error) throw new Error(managers.error.message)
    if (employees.error) throw new Error(employees.error.message)
    return (managers.count ?? 0) + (employees.count ?? 0)
  },

}
